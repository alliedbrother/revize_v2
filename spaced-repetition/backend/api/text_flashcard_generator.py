"""
LangGraph workflow for generating flashcards from manual text input
Uses Gemini with OpenAI fallback to generate exactly 5 focused flashcards
"""
import time
from typing import TypedDict, List, Annotated
import operator
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langsmith import traceable
import json
from .llm_manager import LLMManager
from .logger_config import get_logger, log_flashcard_generation


class TextFlashcardState(TypedDict):
    """State for the text flashcard generation workflow"""
    user_title: str
    user_content: str
    topic_title: str
    flashcards: Annotated[List[dict], operator.add]
    error: str
    llm_provider: str
    llm_metadata: dict
    user_id: str


def validate_input(state: TextFlashcardState) -> TextFlashcardState:
    """
    Node: Validate user input
    """
    title = state.get('user_title', '').strip()
    content = state.get('user_content', '').strip()

    if not title or not content:
        return {
            **state,
            'error': 'Both title and content are required',
            'current_step': 'failed'
        }

    # Let AI decide if content is sufficient (no hard minimum)
    return {
        **state,
        'current_step': 'validated'
    }


def generate_flashcards(state: TextFlashcardState) -> TextFlashcardState:
    """
    Node: Generate flashcards using LLM with fallback
    """
    logger = get_logger(__name__)
    operation_start = time.time()
    user_id = state.get('user_id')

    try:
        # Initialize LLM Manager
        llm_manager = LLMManager(user_id=user_id, temperature=0.7)

        # Enhanced prompt for comprehensive, detailed flashcards
        system_prompt = SystemMessage(content="""You are an expert educational content creator specialized in creating comprehensive, detailed flashcards for deep learning and mastery.

Your task is to analyze the provided text and:
1. Generate a concise, descriptive title for the topic (max 100 characters) - you can use the user's title or create a better one
2. Create **5-8 flashcards** that thoroughly cover the important concepts

Guidelines for creating flashcards:
1. Create 5-8 flashcards based on the complexity and depth of the content
2. Each flashcard should be substantial and detailed (200-400 words)
3. Focus on important concepts, facts, definitions, processes, and relationships
4. Include comprehensive explanations with context, examples, and practical applications
5. Make content self-contained so it can be understood without the original description
6. **Format content using Markdown for better readability:**
   - Use **bold** for key terms and important concepts
   - Use *italics* for secondary emphasis
   - Use bullet points (- or *) or numbered lists for multiple items
   - Use `inline code` for technical terms or code snippets
   - Use ```code blocks``` for multi-line code examples
   - Use > blockquotes for definitions or key takeaways
   - Use line breaks between paragraphs for readability

7. For each flashcard:
   - Start with a clear definition or explanation
   - Provide detailed context and background
   - Include concrete examples or use cases
   - Add relevant details that aid understanding and retention
   - Connect concepts to real-world applications when applicable

Return ONLY a valid JSON object with this exact structure:
{
    "topic_title": "Brief, descriptive title for the topic (max 100 characters)",
    "flashcards": [
        {
            "title": "Concept 1 title (max 100 characters)",
            "content": "Comprehensive explanation in Markdown (200-400 words)"
        },
        {
            "title": "Concept 2 title",
            "content": "Comprehensive explanation..."
        }
    ]
}

IMPORTANT:
- Return ONLY the JSON object, no additional text
- MUST include 5-8 flashcards in the array (adjust based on content depth)
- Use the user's title as context, but you can suggest a better title if appropriate
- Prioritize depth and comprehensiveness over brevity""")

        human_prompt = HumanMessage(content=f"""Create flashcards for the following topic:

Title: {state['user_title']}

Content/Description:
{state['user_content']}

Generate a topic title and 5-8 comprehensive, detailed flashcards that thoroughly cover the key concepts with examples and explanations.""")

        # Call LLM with fallback
        response_text, llm_provider, llm_metadata = llm_manager.call_with_fallback(
            messages=[system_prompt, human_prompt],
            max_retries=3,
            operation_name="manual_text_flashcard_generation"
        )

        # Clean response
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

        # Validate structure
        if not isinstance(result, dict):
            raise ValueError("Response is not a valid JSON object")

        topic_title = result.get("topic_title", state['user_title'])
        flashcards = result.get("flashcards", [])

        if not isinstance(flashcards, list):
            raise ValueError("Flashcards is not a list")

        # Validate 5-8 flashcards
        if len(flashcards) < 5 or len(flashcards) > 8:
            logger.warning(
                f"Expected 5-8 flashcards, got {len(flashcards)}. Adjusting...",
                extra={'user_id': user_id, 'flashcards_count': len(flashcards)}
            )
            # Adjust to acceptable range if needed
            if len(flashcards) < 5:
                # Pad with placeholders to reach 5 minimum
                while len(flashcards) < 5:
                    flashcards.append({
                        'title': f'Additional Review Point {len(flashcards) + 1}',
                        'content': 'Review the previous concepts and expand your understanding of this topic.'
                    })
            elif len(flashcards) > 8:
                # Trim to 8 maximum
                flashcards = flashcards[:8]

        # Validate flashcard structure
        for card in flashcards:
            if "title" not in card or "content" not in card:
                raise ValueError("Flashcard missing required fields (title or content)")

        # Log success
        total_latency = time.time() - operation_start
        log_flashcard_generation(
            logger,
            operation_type='manual_text',
            user_id=user_id,
            input_source=state.get('user_title', ''),
            llm_provider=llm_provider,
            success=True,
            flashcards_count=len(flashcards),
            tokens=llm_metadata.get('tokens_used'),
            latency=total_latency,
            content_length=len(state.get('user_content', ''))
        )

        return {
            **state,
            'topic_title': topic_title,
            'flashcards': flashcards,
            'llm_provider': llm_provider,
            'llm_metadata': llm_metadata,
            'error': ''
        }

    except Exception as e:
        error_msg = str(e)
        total_latency = time.time() - operation_start

        # Log failure
        log_flashcard_generation(
            logger,
            operation_type='manual_text',
            user_id=user_id,
            input_source=state.get('user_title', ''),
            llm_provider=None,
            success=False,
            error=error_msg,
            latency=total_latency,
            content_length=len(state.get('user_content', ''))
        )

        return {
            **state,
            'topic_title': '',
            'flashcards': [],
            'llm_provider': None,
            'llm_metadata': {},
            'error': f'Failed to generate flashcards: {error_msg}'
        }


def should_continue(state: TextFlashcardState) -> str:
    """Conditional edge: Decide if we should continue or end"""
    if state.get('error'):
        return 'end'
    current_step = state.get('current_step', '')
    if current_step == 'validated':
        return 'generate'
    return 'end'


def build_text_flashcard_workflow():
    """Build and compile the LangGraph workflow"""
    workflow = StateGraph(TextFlashcardState)

    # Add nodes
    workflow.add_node("validate", validate_input)
    workflow.add_node("generate", generate_flashcards)

    # Set entry point
    workflow.set_entry_point("validate")

    # Add conditional edges
    workflow.add_conditional_edges(
        "validate",
        should_continue,
        {
            "generate": "generate",
            "end": END
        }
    )

    # End after generation
    workflow.add_edge("generate", END)

    return workflow.compile()


# Create the compiled workflow
text_flashcard_workflow = build_text_flashcard_workflow()


@traceable(
    name="generate_flashcards_from_text",
    metadata={"source": "manual_text"},
    tags=["flashcards", "manual", "llm"]
)
def generate_flashcards_from_text(title: str, content: str, user_id: str = None) -> dict:
    """
    Main function to generate flashcards from manual text input

    Args:
        title: User-provided topic title
        content: User-provided content/description
        user_id: Optional user ID for tracing

    Returns:
        dict: Result containing flashcards, topic_title, llm_provider, or error
        {
            'success': bool,
            'topic_title': str,
            'flashcards': list,
            'error': str,
            'llm_provider': str,
            'llm_metadata': dict
        }
    """
    initial_state = {
        'user_title': title,
        'user_content': content,
        'topic_title': '',
        'flashcards': [],
        'error': '',
        'llm_provider': None,
        'llm_metadata': {},
        'user_id': user_id or ''
    }

    # Run the workflow
    result = text_flashcard_workflow.invoke(
        initial_state,
        config={"metadata": {"user_id": user_id, "title": title}}
    )

    return {
        'success': not bool(result.get('error')),
        'topic_title': result.get('topic_title', title),
        'flashcards': result.get('flashcards', []),
        'error': result.get('error', ''),
        'llm_provider': result.get('llm_provider'),
        'llm_metadata': result.get('llm_metadata', {})
    }
