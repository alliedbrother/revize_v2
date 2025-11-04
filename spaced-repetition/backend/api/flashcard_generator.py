"""
LangGraph workflow for generating flashcards from documents using Gemini
"""
import os
from typing import TypedDict, List, Annotated
import operator
from PyPDF2 import PdfReader
from docx import Document
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
import json


class FlashcardState(TypedDict):
    """State for the flashcard generation workflow"""
    document_path: str
    document_type: str  # 'pdf' or 'docx'
    extracted_text: str
    topic_title: str
    flashcards: Annotated[List[dict], operator.add]
    error: str


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
    Node: Generate flashcards and topic title using Gemini
    """
    try:
        # Get Gemini API key from environment
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found in environment variables")

        # Initialize Gemini model
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash-exp",
            google_api_key=api_key,
            temperature=0.7
        )

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

        human_prompt = HumanMessage(content=f"""Please analyze the following text and create a topic title and detailed flashcards:

{state['extracted_text'][:4000]}

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

        for card in flashcards:
            if "title" not in card or "content" not in card:
                raise ValueError("Flashcard missing required fields (title or content)")

        return {
            **state,
            "topic_title": topic_title,
            "flashcards": flashcards,
            "error": ""
        }

    except Exception as e:
        return {
            **state,
            "topic_title": "",
            "flashcards": [],
            "error": f"Error generating flashcards: {str(e)}"
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


def generate_flashcards_from_document(document_path: str, document_type: str) -> dict:
    """
    Main function to generate flashcards from a document

    Args:
        document_path: Path to the document file
        document_type: Type of document ('pdf' or 'docx')

    Returns:
        dict: Result containing flashcards, topic_title, or error
    """
    initial_state = {
        "document_path": document_path,
        "document_type": document_type,
        "extracted_text": "",
        "topic_title": "",
        "flashcards": [],
        "error": ""
    }

    # Run the workflow
    result = flashcard_workflow.invoke(initial_state)

    return {
        "success": not bool(result.get("error")),
        "topic_title": result.get("topic_title", ""),
        "flashcards": result.get("flashcards", []),
        "error": result.get("error", ""),
        "extracted_text_length": len(result.get("extracted_text", ""))
    }
