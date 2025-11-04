"""
LangGraph workflow for generating flashcards from images using Gemini Vision
"""
import os
import time
from typing import TypedDict, List, Annotated
import operator
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
import json
import base64


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


def process_images_with_vision(state: ImageFlashcardState) -> ImageFlashcardState:
    """
    Node: Send images directly to Gemini Vision API and extract content
    Includes retry logic with exponential backoff
    """
    try:
        retry_count = state.get("retry_count", 0)
        max_retries = state.get("max_retries", 3)

        if retry_count >= max_retries:
            return {
                **state,
                "error": f"Failed to process images after {max_retries} retries",
                "current_step": "failed"
            }

        # Get Gemini API key from environment
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            return {
                **state,
                "error": "GEMINI_API_KEY not found in environment variables",
                "current_step": "failed"
            }

        # Initialize Gemini Vision model
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash-exp",
            google_api_key=api_key,
            temperature=0.3
        )

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
                print(f"Error reading image {img_path}: {str(e)}")
                continue

        if not image_parts:
            return {
                **state,
                "error": "No valid images could be processed",
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

        # Call Gemini Vision API with images
        message_content = [
            {'type': 'text', 'text': vision_prompt}
        ] + image_parts

        response = llm.invoke([HumanMessage(content=message_content)])

        extracted_content = response.content.strip()

        if not extracted_content:
            raise ValueError("Empty response from Gemini Vision API")

        return {
            **state,
            "extracted_content": extracted_content,
            "error": "",
            "retry_count": 0,
            "current_step": "vision_complete"
        }

    except Exception as e:
        # Increment retry count
        new_retry_count = retry_count + 1

        # Exponential backoff
        if new_retry_count < max_retries:
            wait_time = 2 ** new_retry_count
            print(f"Vision API failed (attempt {new_retry_count}/{max_retries}), retrying in {wait_time}s: {str(e)}")
            time.sleep(wait_time)

            return {
                **state,
                "retry_count": new_retry_count,
                "current_step": "vision_retry",
                "error": ""
            }
        else:
            return {
                **state,
                "error": f"Vision extraction failed after {max_retries} retries: {str(e)}",
                "current_step": "failed"
            }


def generate_flashcards_from_content(state: ImageFlashcardState) -> ImageFlashcardState:
    """
    Node: Generate flashcards from extracted content
    Includes retry logic with exponential backoff
    """
    try:
        retry_count = state.get("retry_count", 0)
        max_retries = state.get("max_retries", 3)

        if retry_count >= max_retries:
            return {
                **state,
                "error": f"Failed to generate flashcards after {max_retries} retries",
                "current_step": "failed"
            }

        # Get Gemini API key from environment
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            return {
                **state,
                "error": "GEMINI_API_KEY not found in environment variables",
                "current_step": "failed"
            }

        # Initialize Gemini model
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash-exp",
            google_api_key=api_key,
            temperature=0.7
        )

        # Create the prompt for flashcard generation (same as document workflow)
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

Return ONLY a valid JSON object with this exact structure:
{
    "topic_title": "Brief, descriptive title for the entire topic",
    "flashcards": [
        {
            "title": "Brief title of the concept (max 100 characters)",
            "content": "Detailed explanation of the concept (150-300 words, can include examples, context, and key points)"
        },
        {
            "title": "Another concept title",
            "content": "Another detailed explanation..."
        }
    ]
}

Important: Return ONLY the JSON object, no additional text or formatting.""")

        human_prompt = HumanMessage(content=f"""Please analyze the following content extracted from {state['image_count']} image(s) and create a topic title and detailed flashcards:

{state['extracted_content'][:4000]}

Generate a topic title and 4-10 comprehensive flashcards covering the most important concepts.""")

        # Call Gemini API
        response = llm.invoke([system_prompt, human_prompt])

        # Parse the JSON response
        response_text = response.content.strip()

        # Remove markdown code blocks if present
        if response_text.startswith("```json"):
            response_text = response_text[7:]  # Remove ```json
        if response_text.startswith("```"):
            response_text = response_text[3:]  # Remove ```
        if response_text.endswith("```"):
            response_text = response_text[:-3]  # Remove trailing ```

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

        if len(flashcards) == 0:
            raise ValueError("No flashcards were generated")

        for card in flashcards:
            if "title" not in card or "content" not in card:
                raise ValueError("Flashcard missing required fields (title or content)")

        return {
            **state,
            "topic_title": topic_title,
            "flashcards": flashcards,
            "error": "",
            "retry_count": 0,
            "current_step": "complete"
        }

    except Exception as e:
        # Increment retry count
        new_retry_count = retry_count + 1

        # Exponential backoff
        if new_retry_count < max_retries:
            wait_time = 2 ** new_retry_count
            print(f"Flashcard generation failed (attempt {new_retry_count}/{max_retries}), retrying in {wait_time}s: {str(e)}")
            time.sleep(wait_time)

            return {
                **state,
                "retry_count": new_retry_count,
                "current_step": "flashcard_retry",
                "error": ""
            }
        else:
            return {
                **state,
                "error": f"Flashcard generation failed after {max_retries} retries: {str(e)}",
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


def generate_flashcards_from_images(image_paths: List[str]) -> dict:
    """
    Main function to generate flashcards from images

    Args:
        image_paths: List of paths to image files

    Returns:
        dict: Result containing flashcards, topic_title, or error
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
        "current_step": "start"
    }

    # Run the workflow
    result = image_flashcard_workflow.invoke(initial_state)

    return {
        "success": not bool(result.get("error")),
        "topic_title": result.get("topic_title", ""),
        "flashcards": result.get("flashcards", []),
        "error": result.get("error", ""),
        "extracted_content_length": len(result.get("extracted_content", "")),
        "images_processed": len(image_paths)
    }
