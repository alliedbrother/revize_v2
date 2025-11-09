"""
LangGraph workflow for generating flashcards from web links
Supports: YouTube, Wikipedia, Articles, Generic webpages
"""
import os
import time
import re
from typing import TypedDict, List, Annotated
import operator
from urllib.parse import urlparse, parse_qs, unquote
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langsmith import traceable
import json
from .llm_manager import LLMManager
from .logger_config import get_logger, log_flashcard_generation

# Import content extraction libraries
try:
    from newspaper import Article
except ImportError:
    Article = None

try:
    from youtube_transcript_api import (
        YouTubeTranscriptApi,
        TranscriptsDisabled,
        NoTranscriptFound,
        VideoUnavailable,
        RequestBlocked
    )
except ImportError:
    YouTubeTranscriptApi = None
    TranscriptsDisabled = Exception
    NoTranscriptFound = Exception
    VideoUnavailable = Exception
    RequestBlocked = Exception

try:
    import wikipediaapi
except ImportError:
    wikipediaapi = None


class LinkFlashcardState(TypedDict):
    """State for the link flashcard generation workflow"""
    url: str
    original_url: str
    url_valid: bool
    normalized_url: str
    domain: str
    accessible: bool
    accessibility_error: str
    error_type: str
    status_code: int
    content_type: str
    link_type: str
    html_content: str
    extracted_title: str
    extracted_content: str
    topic_title: str
    flashcards: Annotated[List[dict], operator.add]
    error: str
    retry_count: int
    max_retries: int
    current_step: str
    llm_provider: str  # 'gemini' or 'openai'
    llm_metadata: dict  # Tokens, latency, etc.
    user_id: str  # For logging and tracing


def validate_url(url: str) -> dict:
    """
    Validate URL format and normalize it

    Returns:
        {
            'valid': bool,
            'error': str,
            'normalized_url': str,
            'domain': str
        }
    """
    try:
        # Add https:// if missing
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url

        # Parse URL
        parsed = urlparse(url)

        # Check for valid scheme
        if parsed.scheme not in ['http', 'https']:
            return {
                'valid': False,
                'error': 'Invalid URL scheme. Only http:// and https:// are allowed.',
                'normalized_url': '',
                'domain': ''
            }

        # Check for valid domain
        if not parsed.netloc:
            return {
                'valid': False,
                'error': 'Invalid URL format. Missing domain.',
                'normalized_url': '',
                'domain': ''
            }

        # Check for blacklisted domains
        blacklist = ['localhost', '127.0.0.1', '0.0.0.0', '192.168.', '10.', '172.16.']
        domain_lower = parsed.netloc.lower()

        for blocked in blacklist:
            if blocked in domain_lower:
                return {
                    'valid': False,
                    'error': 'Local or internal URLs are not allowed.',
                    'normalized_url': '',
                    'domain': ''
                }

        # Normalize URL
        normalized_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        if parsed.query:
            # Keep essential query params, remove tracking
            normalized_url += f"?{parsed.query}"

        return {
            'valid': True,
            'error': '',
            'normalized_url': normalized_url,
            'domain': f"{parsed.scheme}://{parsed.netloc}"
        }

    except Exception as e:
        return {
            'valid': False,
            'error': f'Invalid URL format: {str(e)}',
            'normalized_url': '',
            'domain': ''
        }


def check_robots_txt(url: str) -> bool:
    """Check if URL is allowed by robots.txt"""
    try:
        parsed = urlparse(url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"

        rp = RobotFileParser()
        rp.set_url(robots_url)

        try:
            rp.read()
            # Check if our user agent is allowed
            return rp.can_fetch("RevizeBot", url)
        except:
            # If robots.txt doesn't exist or can't be read, allow access
            return True

    except Exception as e:
        # On error, allow access
        print(f"Robots.txt check error: {str(e)}")
        return True


def detect_paywall(html_content: str, url: str) -> bool:
    """Detect common paywall patterns"""
    html_lower = html_content.lower()

    # Common paywall indicators
    paywall_indicators = [
        'paywall',
        'subscriber-only',
        'premium-content',
        'metered-content',
        'subscription-required',
        'article:content_tier="metered"',
        'subscribe to continue',
        'subscribe to read',
        'members-only',
        'subscriber exclusive',
    ]

    for indicator in paywall_indicators:
        if indicator in html_lower:
            return True

    # Site-specific checks
    if 'nytimes.com' in url and 'meteredcount' in html_lower:
        return True
    if 'wsj.com' in url and 'wsj-snippet-login' in html_lower:
        return True
    if 'medium.com' in url and len(html_content) < 5000:
        # Medium often truncates paywalled content
        if 'member-only' in html_lower or 'paywall' in html_lower:
            return True

    return False


def detect_auth_wall(html_content: str, response_url: str) -> bool:
    """Detect login/authentication requirements"""
    html_lower = html_content.lower()

    # Check for login redirects
    if '/login' in response_url or '/signin' in response_url or '/sign-in' in response_url:
        return True

    # Check HTML content
    auth_patterns = [
        'login required',
        'sign in to continue',
        'please log in',
        'authentication required',
        'you must be logged in',
        'please sign in',
    ]

    return any(pattern in html_lower for pattern in auth_patterns)


def check_http_response(url: str, retry_count: int = 0) -> dict:
    """Make HTTP request and analyze response"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
    }

    try:
        response = requests.get(
            url,
            headers=headers,
            timeout=15,
            allow_redirects=True,
            verify=True
        )

        # Check status code
        if response.status_code == 404:
            return {
                'accessible': False,
                'error_type': 'http_404',
                'error': 'Page not found (404)',
                'status_code': 404
            }
        elif response.status_code == 403:
            return {
                'accessible': False,
                'error_type': 'http_403',
                'error': 'Access forbidden (403)',
                'status_code': 403
            }
        elif response.status_code == 401:
            return {
                'accessible': False,
                'error_type': 'auth',
                'error': 'Authentication required (401)',
                'status_code': 401
            }
        elif response.status_code == 451:
            return {
                'accessible': False,
                'error_type': 'geo',
                'error': 'Content unavailable in your region (451)',
                'status_code': 451
            }
        elif response.status_code >= 500:
            return {
                'accessible': False,
                'error_type': 'http_500',
                'error': f'Server error ({response.status_code})',
                'status_code': response.status_code
            }
        elif response.status_code != 200:
            return {
                'accessible': False,
                'error_type': 'http_error',
                'error': f'HTTP error {response.status_code}',
                'status_code': response.status_code
            }

        # Check content type
        content_type = response.headers.get('Content-Type', '').lower()

        # Reject binary files (PDFs, images, etc.)
        if 'application/pdf' in content_type:
            return {
                'accessible': False,
                'error_type': 'pdf',
                'error': 'This is a PDF file. Please upload it using the Document upload option.',
                'status_code': 200
            }

        if 'image/' in content_type:
            return {
                'accessible': False,
                'error_type': 'image',
                'error': 'This is an image file. Please upload it using the Images upload option.',
                'status_code': 200
            }

        # Get HTML content
        html_content = response.text

        # Check for paywall
        if detect_paywall(html_content, url):
            return {
                'accessible': False,
                'error_type': 'paywall',
                'error': 'This content is behind a paywall',
                'status_code': 200
            }

        # Check for auth wall
        if detect_auth_wall(html_content, response.url):
            return {
                'accessible': False,
                'error_type': 'auth',
                'error': 'This content requires login',
                'status_code': 200
            }

        # Success
        return {
            'accessible': True,
            'html_content': html_content,
            'status_code': 200,
            'content_type': content_type,
            'final_url': response.url
        }

    except requests.exceptions.Timeout:
        return {
            'accessible': False,
            'error_type': 'timeout',
            'error': 'Request timed out',
            'status_code': 0
        }
    except requests.exceptions.ConnectionError:
        return {
            'accessible': False,
            'error_type': 'connection_error',
            'error': 'Could not connect to the server',
            'status_code': 0
        }
    except Exception as e:
        return {
            'accessible': False,
            'error_type': 'unknown',
            'error': f'Error accessing URL: {str(e)}',
            'status_code': 0
        }


def extract_youtube_id(url: str) -> str:
    """Extract YouTube video ID from URL"""
    # Handle youtu.be URLs
    if 'youtu.be' in url:
        return url.split('/')[-1].split('?')[0]

    # Handle youtube.com URLs
    parsed = urlparse(url)
    if 'youtube.com' in parsed.netloc:
        query = parse_qs(parsed.query)
        return query.get('v', [''])[0]

    return ''


def extract_youtube_content(url: str) -> dict:
    """Extract YouTube video transcript and metadata"""
    if not YouTubeTranscriptApi:
        return {
            'success': False,
            'error': 'YouTube transcript library not available'
        }

    video_id = None
    title = None
    transcript_text = None

    try:
        video_id = extract_youtube_id(url)

        if not video_id:
            return {
                'success': False,
                'error': 'Could not extract video ID from URL'
            }

        # Get transcript using simple API
        try:
            ytt_api = YouTubeTranscriptApi()
            fetched_transcript = ytt_api.fetch(video_id)

            # Build full transcript
            full_transcript = ""
            for snippet in fetched_transcript:
                full_transcript += str(snippet.text) + " "

            transcript_text = full_transcript.strip()

        except TranscriptsDisabled:
            return {
                'success': False,
                'error': 'Transcripts are disabled for this video'
            }
        except NoTranscriptFound:
            return {
                'success': False,
                'error': 'No English transcript available for this video. Please try a video with captions/subtitles.'
            }
        except VideoUnavailable:
            return {
                'success': False,
                'error': 'Video is unavailable, private, or deleted'
            }
        except RequestBlocked:
            return {
                'success': False,
                'error': 'YouTube is blocking automated requests. Please try again in a few minutes.'
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Unable to retrieve transcript: {str(e)}'
            }

        # Get video title from page (non-critical - can fail gracefully)
        title = f'YouTube Video: {video_id}'  # Default fallback
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            }
            response = requests.get(url, headers=headers, timeout=10)

            # Check if response has content
            if response.text and len(response.text) > 100:
                try:
                    soup = BeautifulSoup(response.text, 'html.parser')
                    title_tag = soup.find('title')
                    if title_tag and title_tag.get_text():
                        extracted_title = title_tag.get_text().replace(' - YouTube', '').strip()
                        if extracted_title and len(extracted_title) >= 3:
                            title = extracted_title
                except:
                    pass  # Keep fallback title
        except:
            pass  # Keep fallback title

        # Even if title extraction failed, we have the transcript, so return success
        content = f"""
Video: {title}

Transcript:
{transcript_text[:8000]}
"""

        return {
            'success': True,
            'title': title,
            'content': content
        }

    except Exception as e:
        # Catch any unexpected errors
        error_msg = str(e).lower()
        return {
            'success': False,
            'error': f'Unexpected error extracting YouTube content: {str(e)}'
        }


def extract_wikipedia_content(url: str) -> dict:
    """Extract Wikipedia article content"""
    if not wikipediaapi:
        return {
            'success': False,
            'error': 'Wikipedia library not available'
        }

    try:
        # Extract page title from URL
        parsed = urlparse(url)
        path_parts = parsed.path.split('/')

        page_title = ''
        for part in path_parts:
            if part and part != 'wiki':
                page_title = unquote(part.replace('_', ' '))
                break

        if not page_title:
            return {
                'success': False,
                'error': 'Could not extract Wikipedia page title'
            }

        # Get Wikipedia page
        wiki = wikipediaapi.Wikipedia(
            language='en',
            user_agent='RevizeBot/1.0 (https://revize.live)'
        )

        page = wiki.page(page_title)

        if not page.exists():
            return {
                'success': False,
                'error': 'Wikipedia page not found'
            }

        # Get content (limit to 8000 chars)
        content = page.text[:8000]

        return {
            'success': True,
            'title': page.title,
            'content': content
        }

    except Exception as e:
        return {
            'success': False,
            'error': f'Error extracting Wikipedia content: {str(e)}'
        }


def extract_article_content(url: str, html_content: str) -> dict:
    """Extract article content using newspaper3k"""
    if not Article:
        return extract_generic_content(url, html_content)

    try:
        article = Article(url)
        article.download(input_html=html_content)
        article.parse()

        if len(article.text) > 200:
            return {
                'success': True,
                'title': article.title or 'Article',
                'content': article.text[:8000]
            }
        else:
            # Fallback to generic extraction
            return extract_generic_content(url, html_content)

    except Exception as e:
        # Fallback to generic extraction
        return extract_generic_content(url, html_content)


def extract_generic_content(url: str, html_content: str) -> dict:
    """Extract content using BeautifulSoup (fallback method)"""
    try:
        soup = BeautifulSoup(html_content, 'html.parser')

        # Remove noise
        for tag in soup(['script', 'style', 'nav', 'header', 'footer', 'aside', 'iframe', 'noscript']):
            tag.decompose()

        # Find title
        title = ''
        if soup.find('h1'):
            title = soup.find('h1').get_text(strip=True)
        elif soup.find('title'):
            title = soup.find('title').get_text(strip=True)

        # Find main content
        main_content = None
        for selector in ['article', 'main', '[role="main"]', '.content', '.post-content', '.article-content']:
            main_content = soup.select_one(selector)
            if main_content:
                break

        if not main_content:
            main_content = soup.find('body')

        if not main_content:
            return {
                'success': False,
                'error': 'Could not extract content from page'
            }

        # Extract text from paragraphs
        paragraphs = main_content.find_all(['p', 'h2', 'h3', 'li'])
        text_parts = []

        for p in paragraphs:
            text = p.get_text(strip=True)
            if len(text) > 30:  # Ignore short snippets
                text_parts.append(text)

        content = '\n\n'.join(text_parts)[:8000]

        if len(content) < 200:
            return {
                'success': False,
                'error': 'Not enough content extracted from page. The page may be mostly images or require JavaScript.'
            }

        return {
            'success': True,
            'title': title or 'Web Page',
            'content': content
        }

    except Exception as e:
        return {
            'success': False,
            'error': f'Error extracting content: {str(e)}'
        }


def detect_link_type(url: str) -> str:
    """Detect the type of link"""
    url_lower = url.lower()

    if 'youtube.com' in url_lower or 'youtu.be' in url_lower:
        return 'youtube'

    if 'wikipedia.org' in url_lower:
        return 'wikipedia'

    # Default to article
    return 'article'


# LangGraph Nodes

def validate_url_node(state: LinkFlashcardState) -> LinkFlashcardState:
    """Node: Validate URL format"""
    url = state['url']

    validation = validate_url(url)

    if not validation['valid']:
        return {
            **state,
            'url_valid': False,
            'error': validation['error'],
            'current_step': 'failed'
        }

    return {
        **state,
        'url_valid': True,
        'normalized_url': validation['normalized_url'],
        'domain': validation['domain'],
        'current_step': 'url_validated'
    }


def check_accessibility_node(state: LinkFlashcardState) -> LinkFlashcardState:
    """Node: Check URL accessibility"""
    retry_count = state.get('retry_count', 0)
    max_retries = state.get('max_retries', 3)

    if retry_count >= max_retries:
        return {
            **state,
            'error': f'Failed to access URL after {max_retries} retries',
            'current_step': 'failed'
        }

    url = state['normalized_url']

    # YouTube URLs don't need HTTP accessibility/paywall check
    # They will be validated during transcript extraction
    link_type = detect_link_type(url)
    if link_type == 'youtube':
        return {
            **state,
            'accessible': True,
            'html_content': '',
            'status_code': 200,
            'content_type': 'text/html',
            'link_type': 'youtube',
            'current_step': 'accessible'
        }

    # Check robots.txt
    if not check_robots_txt(url):
        return {
            **state,
            'accessible': False,
            'error_type': 'robots',
            'error': 'This website does not allow automated access (blocked by robots.txt)',
            'current_step': 'failed'
        }

    # Check HTTP response
    response_check = check_http_response(url, retry_count)

    if not response_check['accessible']:
        error_type = response_check['error_type']

        # Retry on transient errors
        if error_type in ['timeout', 'http_500', 'connection_error']:
            new_retry_count = retry_count + 1
            if new_retry_count < max_retries:
                time.sleep(2 ** new_retry_count)
                return {
                    **state,
                    'retry_count': new_retry_count,
                    'current_step': 'accessibility_retry'
                }

        # Permanent error
        return {
            **state,
            'accessible': False,
            'error_type': error_type,
            'error': response_check['error'],
            'status_code': response_check.get('status_code', 0),
            'current_step': 'failed'
        }

    return {
        **state,
        'accessible': True,
        'html_content': response_check['html_content'],
        'status_code': response_check['status_code'],
        'content_type': response_check['content_type'],
        'normalized_url': response_check.get('final_url', state['normalized_url']),
        'retry_count': 0,
        'current_step': 'accessible'
    }


def extract_content_node(state: LinkFlashcardState) -> LinkFlashcardState:
    """Node: Extract content from URL"""
    retry_count = state.get('retry_count', 0)
    max_retries = state.get('max_retries', 3)

    if retry_count >= max_retries:
        return {
            **state,
            'error': 'Failed to extract content after multiple attempts',
            'current_step': 'failed'
        }

    url = state['normalized_url']
    html_content = state.get('html_content', '')

    # Detect link type
    link_type = detect_link_type(url)

    try:
        # Extract based on type
        if link_type == 'youtube':
            result = extract_youtube_content(url)
        elif link_type == 'wikipedia':
            result = extract_wikipedia_content(url)
        else:
            result = extract_article_content(url, html_content)

        if not result['success']:
            # Check if we should retry
            new_retry_count = retry_count + 1
            if new_retry_count < max_retries:
                time.sleep(2 ** new_retry_count)
                return {
                    **state,
                    'retry_count': new_retry_count,
                    'current_step': 'extraction_retry'
                }
            else:
                return {
                    **state,
                    'error': result['error'],
                    'error_type': 'extraction_failed',
                    'current_step': 'failed'
                }

        return {
            **state,
            'link_type': link_type,
            'extracted_title': result['title'],
            'extracted_content': result['content'],
            'retry_count': 0,
            'current_step': 'content_extracted'
        }

    except Exception as e:
        new_retry_count = retry_count + 1
        if new_retry_count < max_retries:
            time.sleep(2 ** new_retry_count)
            return {
                **state,
                'retry_count': new_retry_count,
                'current_step': 'extraction_retry'
            }
        else:
            return {
                **state,
                'error': f'Content extraction failed: {str(e)}',
                'error_type': 'extraction_failed',
                'current_step': 'failed'
            }


def generate_flashcards_node(state: LinkFlashcardState) -> LinkFlashcardState:
    """Node: Generate flashcards using LLM manager with Gemini->OpenAI fallback"""
    logger = get_logger(__name__)
    operation_start = time.time()
    user_id = state.get('user_id')

    try:
        # Initialize LLM Manager
        llm_manager = LLMManager(user_id=user_id, temperature=0.7)

        # Create prompts
        system_prompt = SystemMessage(content="""You are an expert educational content creator specialized in creating detailed, comprehensive flashcards for effective learning.

Your task is to analyze the provided text and:
1. Generate a concise, descriptive title for the topic (max 100 characters)
2. Create 4-10 detailed flashcards that cover the key concepts, important information, and critical details

Guidelines for creating flashcards:
1. Each flashcard should be substantial and detailed (150-300 words)
2. Focus on important concepts, facts, definitions, and processes
3. Include context and explanations, not just isolated facts
4. Make content self-contained so it can be understood without the original document
5. Use clear, concise language but provide thorough explanations
6. Include examples where relevant
7. Cover different aspects of the content (concepts, applications, comparisons, etc.)
8. **Format content using Markdown for better readability:**
   - Use **bold** for key terms, important concepts, and emphasis
   - Use *italics* for secondary emphasis or introducing terms
   - Use bullet points (- or *) or numbered lists (1., 2., 3.) for steps, features, or multiple items
   - Use `inline code` for technical terms, commands, variable names, or code snippets
   - Use ```code blocks``` for multi-line code examples
   - Use > blockquotes for definitions, important quotes, or key takeaways
   - Use headings (### or ####) if structuring complex concepts into sections
   - Use line breaks between paragraphs for better readability
   - Use horizontal rules (---) to separate major sections if needed

Return ONLY a valid JSON object with this exact structure:
{
    "topic_title": "Brief, descriptive title for the entire topic",
    "flashcards": [
        {
            "title": "Brief title of the concept (max 100 characters)",
            "content": "Detailed explanation in Markdown format (150-300 words, with proper formatting for readability)"
        },
        {
            "title": "Another concept title",
            "content": "Another detailed explanation with Markdown formatting..."
        }
    ]
}

Important: Return ONLY the JSON object, no additional text or formatting.""")

        human_prompt = HumanMessage(content=f"""
Analyze the following {state['link_type']} content and create comprehensive flashcards:

Source: {state['normalized_url']}
Title: {state['extracted_title']}

Content:
{state['extracted_content'][:4000]}

Generate a topic title and 4-10 comprehensive flashcards covering the most important concepts.
""")

        # Call LLM with fallback
        response_text, llm_provider, llm_metadata = llm_manager.call_with_fallback(
            messages=[system_prompt, human_prompt],
            max_retries=3,
            operation_name="link_flashcard_generation"
        )

        # Remove markdown code blocks
        response_text = response_text.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()

        # Parse JSON
        result = json.loads(response_text)

        # Validate
        if not isinstance(result, dict):
            raise ValueError("Response is not a valid JSON object")

        topic_title = result.get("topic_title", "")
        flashcards = result.get("flashcards", [])

        if not isinstance(flashcards, list) or len(flashcards) == 0:
            raise ValueError("No flashcards generated")

        for card in flashcards:
            if "title" not in card or "content" not in card:
                raise ValueError("Flashcard missing required fields")

        # Log successful generation
        total_latency = time.time() - operation_start
        log_flashcard_generation(
            logger,
            operation_type='link',
            user_id=user_id,
            input_source=state.get('normalized_url', ''),
            llm_provider=llm_provider,
            success=True,
            flashcards_count=len(flashcards),
            tokens=llm_metadata.get('tokens_used'),
            latency=total_latency,
            link_type=state.get('link_type', ''),
            content_length=len(state.get('extracted_content', ''))
        )

        return {
            **state,
            'topic_title': topic_title,
            'flashcards': flashcards,
            'llm_provider': llm_provider,
            'llm_metadata': llm_metadata,
            'retry_count': 0,
            'error': '',
            'current_step': 'complete'
        }

    except Exception as e:
        error_msg = str(e)
        total_latency = time.time() - operation_start

        # Log failed generation
        log_flashcard_generation(
            logger,
            operation_type='link',
            user_id=user_id,
            input_source=state.get('normalized_url', ''),
            llm_provider=None,
            success=False,
            error=error_msg,
            latency=total_latency,
            link_type=state.get('link_type', ''),
            content_length=len(state.get('extracted_content', ''))
        )

        return {
            **state,
            'topic_title': '',
            'flashcards': [],
            'llm_provider': None,
            'llm_metadata': {},
            'error': f'Flashcard generation failed: {error_msg}',
            'error_type': 'generation_failed',
            'current_step': 'failed'
        }


# Conditional edges

def should_continue_from_validation(state: LinkFlashcardState) -> str:
    """Route after URL validation"""
    if not state.get('url_valid'):
        return 'end'
    return 'check_accessibility'


def should_continue_from_accessibility(state: LinkFlashcardState) -> str:
    """Route after accessibility check"""
    current_step = state.get('current_step')

    if current_step == 'failed':
        return 'end'
    if current_step == 'accessibility_retry':
        return 'check_accessibility'
    if state.get('accessible'):
        return 'extract_content'
    return 'end'


def should_continue_from_extraction(state: LinkFlashcardState) -> str:
    """Route after content extraction"""
    current_step = state.get('current_step')

    if current_step == 'failed':
        return 'end'
    if current_step == 'extraction_retry':
        return 'extract_content'
    if state.get('extracted_content'):
        return 'generate_flashcards'
    return 'end'


def should_continue_from_flashcards(state: LinkFlashcardState) -> str:
    """Route after flashcard generation"""
    current_step = state.get('current_step')

    if current_step == 'flashcard_retry':
        return 'generate_flashcards'
    return 'end'


# Build workflow

def build_link_flashcard_workflow():
    """Build and compile the LangGraph workflow"""
    workflow = StateGraph(LinkFlashcardState)

    # Add nodes
    workflow.add_node("validate_url", validate_url_node)
    workflow.add_node("check_accessibility", check_accessibility_node)
    workflow.add_node("extract_content", extract_content_node)
    workflow.add_node("generate_flashcards", generate_flashcards_node)

    # Set entry point
    workflow.set_entry_point("validate_url")

    # Add conditional edges
    workflow.add_conditional_edges(
        "validate_url",
        should_continue_from_validation,
        {
            "check_accessibility": "check_accessibility",
            "end": END
        }
    )

    workflow.add_conditional_edges(
        "check_accessibility",
        should_continue_from_accessibility,
        {
            "check_accessibility": "check_accessibility",
            "extract_content": "extract_content",
            "end": END
        }
    )

    workflow.add_conditional_edges(
        "extract_content",
        should_continue_from_extraction,
        {
            "extract_content": "extract_content",
            "generate_flashcards": "generate_flashcards",
            "end": END
        }
    )

    workflow.add_conditional_edges(
        "generate_flashcards",
        should_continue_from_flashcards,
        {
            "generate_flashcards": "generate_flashcards",
            "end": END
        }
    )

    return workflow.compile()


# Create workflow instance
link_flashcard_workflow = build_link_flashcard_workflow()


@traceable(
    name="generate_flashcards_from_link",
    metadata={"source": "web_link"},
    tags=["flashcards", "web-scraping", "llm"]
)
def generate_flashcards_from_link(url: str, user_id: str = None) -> dict:
    """
    Main function to generate flashcards from a web link

    Args:
        url: Web link URL
        user_id: Optional user ID for tracing

    Returns:
        {
            'success': bool,
            'topic_title': str,
            'flashcards': list,
            'error': str,
            'error_type': str,
            'link_type': str,
            'extracted_content_length': int,
            'llm_provider': str,
            'llm_metadata': dict
        }
    """
    initial_state = {
        'url': url,
        'original_url': url,
        'url_valid': False,
        'normalized_url': '',
        'domain': '',
        'accessible': False,
        'accessibility_error': '',
        'error_type': '',
        'status_code': 0,
        'content_type': '',
        'link_type': '',
        'html_content': '',
        'extracted_title': '',
        'extracted_content': '',
        'topic_title': '',
        'flashcards': [],
        'error': '',
        'retry_count': 0,
        'max_retries': 3,
        'current_step': 'start',
        'llm_provider': None,
        'llm_metadata': {},
        'user_id': user_id or ''
    }

    # Run workflow with metadata
    result = link_flashcard_workflow.invoke(
        initial_state,
        config={"metadata": {"user_id": user_id, "url": url}}
    )

    return {
        'success': not bool(result.get('error')),
        'topic_title': result.get('topic_title', ''),
        'flashcards': result.get('flashcards', []),
        'error': result.get('error', ''),
        'error_type': result.get('error_type', ''),
        'link_type': result.get('link_type', 'unknown'),
        'extracted_content_length': len(result.get('extracted_content', '')),
        'llm_provider': result.get('llm_provider'),
        'llm_metadata': result.get('llm_metadata', {})
    }
