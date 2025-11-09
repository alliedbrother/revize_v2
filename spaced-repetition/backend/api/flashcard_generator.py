"""
LangGraph workflow for generating flashcards from documents using Gemini with OpenAI fallback
"""
import os
import time
from typing import TypedDict, List, Annotated
import operator
from PyPDF2 import PdfReader
from docx import Document
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langsmith import traceable
import json
from .llm_manager import LLMManager
from .logger_config import get_logger, log_flashcard_generation


class FlashcardState(TypedDict):
    """State for the flashcard generation workflow"""
    document_path: str
    document_type: str  # 'pdf' or 'docx'
    extracted_text: str
    topic_title: str
    flashcards: Annotated[List[dict], operator.add]
    error: str
    llm_provider: str  # 'gemini' or 'openai'
    llm_metadata: dict  # Tokens, latency, etc.
    user_id: str  # For logging and tracing


def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from PDF document"""
    try:
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        raise Exception(f"Error extracting text from PDF: {str(e)}")


def extract_text_from_docx(file_path: str) -> str:
    """Extract text from DOCX document"""
    try:
        doc = Document(file_path)
        text = ""
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
        return text.strip()
    except Exception as e:
        raise Exception(f"Error extracting text from DOCX: {str(e)}")


def extract_document_text(state: FlashcardState) -> FlashcardState:
    """
    Node: Extract text from the uploaded document
    """
    try:
        file_path = state["document_path"]
        doc_type = state["document_type"]

        if doc_type == "pdf":
            text = extract_text_from_pdf(file_path)
        elif doc_type == "docx":
            text = extract_text_from_docx(file_path)
        else:
            raise ValueError(f"Unsupported document type: {doc_type}")

        return {
            **state,
            "extracted_text": text,
            "error": ""
        }
    except Exception as e:
        return {
            **state,
            "extracted_text": "",
            "error": str(e)
        }


def generate_flashcards(state: FlashcardState) -> FlashcardState:
    """
    Node: Generate flashcards and topic title using LLM with fallback
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

        human_prompt = HumanMessage(content=f"""Please analyze the following text and create a topic title and detailed flashcards:

{state['extracted_text'][:4000]}

Generate a topic title and 4-10 comprehensive flashcards covering the most important concepts.""")

        # Call LLM with fallback (Gemini -> OpenAI)
        response_text, llm_provider, llm_metadata = llm_manager.call_with_fallback(
            messages=[system_prompt, human_prompt],
            max_retries=3,
            operation_name="document_flashcard_generation"
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
            operation_type='document',
            user_id=user_id,
            input_source=state.get('document_path', ''),
            llm_provider=llm_provider,
            success=True,
            flashcards_count=len(flashcards),
            tokens=llm_metadata.get('tokens_used'),
            latency=total_latency,
            document_type=state.get('document_type', ''),
            text_length=len(state.get('extracted_text', ''))
        )

        return {
            **state,
            "topic_title": topic_title,
            "flashcards": flashcards,
            "llm_provider": llm_provider,
            "llm_metadata": llm_metadata,
            "error": ""
        }

    except Exception as e:
        error_msg = str(e)
        total_latency = time.time() - operation_start

        # Log failed generation
        log_flashcard_generation(
            logger,
            operation_type='document',
            user_id=user_id,
            input_source=state.get('document_path', ''),
            llm_provider=None,
            success=False,
            error=error_msg,
            latency=total_latency,
            document_type=state.get('document_type', ''),
            text_length=len(state.get('extracted_text', ''))
        )

        return {
            **state,
            "topic_title": "",
            "flashcards": [],
            "llm_provider": None,
            "llm_metadata": {},
            "error": f"Error generating flashcards: {error_msg}"
        }


def should_continue(state: FlashcardState) -> str:
    """
    Conditional edge: Decide if we should continue or end
    """
    if state.get("error"):
        return "end"
    if not state.get("extracted_text"):
        return "end"
    return "generate"


def build_flashcard_workflow():
    """
    Build and compile the LangGraph workflow
    """
    # Create the graph
    workflow = StateGraph(FlashcardState)

    # Add nodes
    workflow.add_node("extract", extract_document_text)
    workflow.add_node("generate", generate_flashcards)

    # Add edges
    workflow.set_entry_point("extract")

    # Add conditional edge
    workflow.add_conditional_edges(
        "extract",
        should_continue,
        {
            "generate": "generate",
            "end": END
        }
    )

    # End after generation
    workflow.add_edge("generate", END)

    # Compile the graph
    return workflow.compile()


# Create the compiled workflow
flashcard_workflow = build_flashcard_workflow()


@traceable(
    name="generate_flashcards_from_document",
    metadata={"source": "document"},
    tags=["flashcards", "document", "llm"]
)
def generate_flashcards_from_document(document_path: str, document_type: str, user_id: str = None) -> dict:
    """
    Main function to generate flashcards from a document

    Args:
        document_path: Path to the document file
        document_type: Type of document ('pdf' or 'docx')
        user_id: Optional user ID for tracing

    Returns:
        dict: Result containing flashcards, topic_title, llm_provider, or error
    """
    initial_state = {
        "document_path": document_path,
        "document_type": document_type,
        "extracted_text": "",
        "topic_title": "",
        "flashcards": [],
        "error": "",
        "llm_provider": None,
        "llm_metadata": {},
        "user_id": user_id or ""
    }

    # Run the workflow
    result = flashcard_workflow.invoke(
        initial_state,
        config={"metadata": {"user_id": user_id, "document_type": document_type}}
    )

    return {
        "success": not bool(result.get("error")),
        "topic_title": result.get("topic_title", ""),
        "flashcards": result.get("flashcards", []),
        "error": result.get("error", ""),
        "extracted_text_length": len(result.get("extracted_text", "")),
        "llm_provider": result.get("llm_provider"),
        "llm_metadata": result.get("llm_metadata", {})
    }
