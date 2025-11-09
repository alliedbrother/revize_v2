"""
LangGraph workflow for generating flashcards from images using Gemini Vision with OpenAI fallback
"""
import os
import time
from typing import TypedDict, List, Annotated
import operator
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langsmith import traceable
import json
import base64
from .llm_manager import LLMManager
from .logger_config import get_logger, log_flashcard_generation


class ImageFlashcardState(TypedDict):
    """State for the image flashcard generation workflow"""
    image_paths: Annotated[List[str], operator.add]
    image_count: int
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


def process_images_with_vision(state: ImageFlashcardState) -> ImageFlashcardState:
    """
    Node: Send images directly to Gemini Vision API and extract content
    Uses LLM manager with Gemini->OpenAI fallback
    """
    logger = get_logger(__name__)
    operation_start = time.time()
    user_id = state.get('user_id')

    try:
        # Initialize LLM Manager for vision processing
        llm_manager = LLMManager(user_id=user_id, temperature=0.3)

        # Prepare images for API - convert to base64
        image_parts = []
        for img_path in state["image_paths"]:
            try:
                with open(img_path, 'rb') as f:
                    image_data = base64.b64encode(f.read()).decode()
                    # Determine image type
                    if img_path.lower().endswith('.png'):
                        mime_type = 'image/png'
                    elif img_path.lower().endswith('.webp'):
                        mime_type = 'image/webp'
                    else:
                        mime_type = 'image/jpeg'

                    image_parts.append({
                        'type': 'image_url',
                        'image_url': {
                            'url': f'data:{mime_type};base64,{image_data}'
                        }
                    })
            except Exception as e:
                logger.error(f"Error reading image {img_path}: {str(e)}",
                           extra={'user_id': user_id, 'image_path': img_path})
                continue

        if not image_parts:
            error_msg = "No valid images could be processed"
            logger.error(error_msg, extra={'user_id': user_id})
            return {
                **state,
                "error": error_msg,
                "current_step": "failed"
            }

        # Create comprehensive prompt for vision analysis
        vision_prompt = """Analyze these images and extract ALL educational content, text, and concepts.

Your task:
1. Extract ALL text visible in the images (OCR)
2. Describe diagrams, charts, graphs, and visual elements
3. Identify key concepts, definitions, formulas, and processes
4. Capture any annotations, highlights, or handwritten notes
5. Explain relationships and connections shown in visuals

Provide a COMPREHENSIVE summary that captures EVERYTHING a student needs to learn from these images.
Be thorough and detailed - don't miss any important information."""

        # Create message with text and images
        message_content = [
            {'type': 'text', 'text': vision_prompt}
        ] + image_parts

        # Call LLM with fallback for vision processing
        response_text, llm_provider, llm_metadata = llm_manager.call_with_fallback(
            messages=[HumanMessage(content=message_content)],
            max_retries=3,
            operation_name="image_vision_extraction"
        )

        extracted_content = response_text.strip()

        if not extracted_content:
            raise ValueError("Empty response from vision API")

        # Log successful vision extraction
        total_latency = time.time() - operation_start
        logger.info(
            f"Vision extraction completed: {len(extracted_content)} chars, provider: {llm_provider}",
            extra={
                'user_id': user_id,
                'operation': 'image_vision_extraction',
                'llm_provider': llm_provider,
                'success': True,
                'image_count': state['image_count'],
                'content_length': len(extracted_content),
                'tokens': llm_metadata.get('tokens_used'),
                'latency': total_latency
            }
        )

        return {
            **state,
            "extracted_content": extracted_content,
            "llm_provider": llm_provider,
            "llm_metadata": llm_metadata,
            "error": "",
            "retry_count": 0,
            "current_step": "vision_complete"
        }

    except Exception as e:
        error_msg = str(e)
        total_latency = time.time() - operation_start

        # Log failed vision extraction
        logger.error(
            f"Vision extraction failed: {error_msg}",
            extra={
                'user_id': user_id,
                'operation': 'image_vision_extraction',
                'success': False,
                'error': error_msg,
                'image_count': state.get('image_count', 0),
                'latency': total_latency
            }
        )

        return {
            **state,
            "error": f"Vision extraction failed: {error_msg}",
            "current_step": "failed"
        }


def generate_flashcards_from_content(state: ImageFlashcardState) -> ImageFlashcardState:
    """
    Node: Generate flashcards from extracted content
    Uses LLM manager with Gemini->OpenAI fallback
    """
    logger = get_logger(__name__)
    operation_start = time.time()
    user_id = state.get('user_id')

    try:
        # Initialize LLM Manager
        llm_manager = LLMManager(user_id=user_id, temperature=0.7)

        # Create the prompt for flashcard generation
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

        human_prompt = HumanMessage(content=f"""Please analyze the following content extracted from {state['image_count']} image(s) and create a topic title and detailed flashcards:

{state['extracted_content'][:4000]}

Generate a topic title and 4-10 comprehensive flashcards covering the most important concepts.""")

        # Call LLM with fallback
        response_text, llm_provider, llm_metadata = llm_manager.call_with_fallback(
            messages=[system_prompt, human_prompt],
            max_retries=3,
            operation_name="image_flashcard_generation"
        )

        # Remove markdown code blocks if present
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

        # Validate response structure
        if not isinstance(result, dict):
            raise ValueError("Response is not a valid JSON object")

        topic_title = result.get("topic_title", "")
        flashcards = result.get("flashcards", [])

        if not isinstance(flashcards, list):
            raise ValueError("Flashcards is not a list")

        for card in flashcards:
            if "title" not in card or "content" not in card:
                raise ValueError("Flashcard missing required fields (title or content)")

        # Log successful generation
        total_latency = time.time() - operation_start
        log_flashcard_generation(
            logger,
            operation_type='image',
            user_id=user_id,
            input_source=f"{state.get('image_count', 0)} images",
            llm_provider=llm_provider,
            success=True,
            flashcards_count=len(flashcards),
            tokens=llm_metadata.get('tokens_used'),
            latency=total_latency,
            image_count=state.get('image_count', 0),
            content_length=len(state.get('extracted_content', ''))
        )

        return {
            **state,
            "topic_title": topic_title,
            "flashcards": flashcards,
            "llm_provider": llm_provider,
            "llm_metadata": llm_metadata,
            "error": "",
            "retry_count": 0,
            "current_step": "complete"
        }

    except Exception as e:
        error_msg = str(e)
        total_latency = time.time() - operation_start

        # Log failed generation
        log_flashcard_generation(
            logger,
            operation_type='image',
            user_id=user_id,
            input_source=f"{state.get('image_count', 0)} images",
            llm_provider=None,
            success=False,
            error=error_msg,
            latency=total_latency,
            image_count=state.get('image_count', 0),
            content_length=len(state.get('extracted_content', ''))
        )

        return {
            **state,
            "topic_title": "",
            "flashcards": [],
            "llm_provider": None,
            "llm_metadata": {},
            "error": f"Flashcard generation failed: {error_msg}",
            "current_step": "failed"
        }


def should_continue_vision(state: ImageFlashcardState) -> str:
    """
    Conditional edge: Decide if we should retry vision or continue to flashcard generation
    """
    current_step = state.get("current_step", "")

    if state.get("error") and current_step == "failed":
        return "end"

    if current_step == "vision_retry":
        return "process_vision"

    if state.get("extracted_content"):
        return "generate_flashcards"

    return "end"


def should_continue_flashcard(state: ImageFlashcardState) -> str:
    """
    Conditional edge: Decide if we should retry flashcard generation or end
    """
    current_step = state.get("current_step", "")

    if state.get("error") and current_step == "failed":
        return "end"

    if current_step == "flashcard_retry":
        return "generate_flashcards"

    if state.get("flashcards"):
        return "end"

    return "end"


def build_image_flashcard_workflow():
    """
    Build and compile the LangGraph workflow for image processing
    """
    # Create the graph
    workflow = StateGraph(ImageFlashcardState)

    # Add nodes
    workflow.add_node("process_vision", process_images_with_vision)
    workflow.add_node("generate_flashcards", generate_flashcards_from_content)

    # Add edges
    workflow.set_entry_point("process_vision")

    # Add conditional edge after vision processing
    workflow.add_conditional_edges(
        "process_vision",
        should_continue_vision,
        {
            "process_vision": "process_vision",  # Retry vision
            "generate_flashcards": "generate_flashcards",  # Continue to flashcard generation
            "end": END
        }
    )

    # Add conditional edge after flashcard generation
    workflow.add_conditional_edges(
        "generate_flashcards",
        should_continue_flashcard,
        {
            "generate_flashcards": "generate_flashcards",  # Retry flashcard generation
            "end": END
        }
    )

    # Compile the graph
    return workflow.compile()


# Create the compiled workflow
image_flashcard_workflow = build_image_flashcard_workflow()


@traceable(
    name="generate_flashcards_from_images",
    metadata={"source": "images"},
    tags=["flashcards", "images", "llm"]
)
def generate_flashcards_from_images(image_paths: List[str], user_id: str = None) -> dict:
    """
    Main function to generate flashcards from images

    Args:
        image_paths: List of paths to image files
        user_id: Optional user ID for tracing

    Returns:
        dict: Result containing flashcards, topic_title, llm_provider, or error
    """
    initial_state = {
        "image_paths": image_paths,
        "image_count": len(image_paths),
        "extracted_content": "",
        "topic_title": "",
        "flashcards": [],
        "error": "",
        "retry_count": 0,
        "max_retries": 3,
        "current_step": "start",
        "llm_provider": None,
        "llm_metadata": {},
        "user_id": user_id or ""
    }

    # Run the workflow with metadata
    result = image_flashcard_workflow.invoke(
        initial_state,
        config={"metadata": {"user_id": user_id, "image_count": len(image_paths)}}
    )

    return {
        "success": not bool(result.get("error")),
        "topic_title": result.get("topic_title", ""),
        "flashcards": result.get("flashcards", []),
        "error": result.get("error", ""),
        "extracted_content_length": len(result.get("extracted_content", "")),
        "images_processed": len(image_paths),
        "llm_provider": result.get("llm_provider"),
        "llm_metadata": result.get("llm_metadata", {})
    }
