"""
Logging configuration for flashcard generation system
Provides structured JSON logging with rotation for production monitoring
"""
import logging
import logging.handlers
import os
from pythonjsonlogger import jsonlogger
from django.conf import settings


class CustomJsonFormatter(jsonlogger.JsonFormatter):
    """
    Custom JSON formatter that adds standard fields to all log records
    """
    def add_fields(self, log_record, record, message_dict):
        super(CustomJsonFormatter, self).add_fields(log_record, record, message_dict)

        # Add timestamp
        if not log_record.get('timestamp'):
            log_record['timestamp'] = record.created

        # Add level
        if not log_record.get('level'):
            log_record['level'] = record.levelname

        # Add logger name
        if not log_record.get('logger'):
            log_record['logger'] = record.name


def get_logger(name):
    """
    Get a configured logger instance with both console and file handlers

    Args:
        name: Logger name (typically __name__ from calling module)

    Returns:
        logging.Logger: Configured logger instance
    """
    logger = logging.getLogger(name)

    # Only configure handlers once
    if not logger.handlers:
        logger.setLevel(logging.DEBUG)

        # Console handler for development (human-readable)
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        console_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        console_handler.setFormatter(console_formatter)

        # File handler with rotation (JSON for parsing/analytics)
        log_dir = os.path.join(settings.BASE_DIR, 'logs')
        os.makedirs(log_dir, exist_ok=True)

        file_handler = logging.handlers.RotatingFileHandler(
            os.path.join(log_dir, 'flashcard_generation.log'),
            maxBytes=10 * 1024 * 1024,  # 10MB per file
            backupCount=10,  # Keep 10 backup files
            encoding='utf-8'
        )
        file_handler.setLevel(logging.DEBUG)

        # JSON formatter for structured logging
        json_formatter = CustomJsonFormatter(
            '%(timestamp)s %(level)s %(logger)s %(message)s'
        )
        file_handler.setFormatter(json_formatter)

        # Add handlers
        logger.addHandler(console_handler)
        logger.addHandler(file_handler)

        # Prevent propagation to avoid duplicate logs
        logger.propagate = False

    return logger


def log_llm_call(logger, operation, user_id=None, llm_provider=None,
                 success=True, tokens=None, latency=None, error=None, **kwargs):
    """
    Convenience function to log LLM API calls with standard metadata

    Args:
        logger: Logger instance
        operation: Operation name (e.g., "document_flashcard_generation")
        user_id: User ID making the request
        llm_provider: LLM provider used ("gemini" or "openai")
        success: Whether the call succeeded
        tokens: Dict with token counts (input_tokens, output_tokens, total_tokens)
        latency: Call latency in seconds
        error: Error message if call failed
        **kwargs: Additional metadata to log
    """
    log_data = {
        'operation': operation,
        'user_id': user_id,
        'llm_provider': llm_provider,
        'success': success,
    }

    if tokens:
        log_data['tokens'] = tokens

    if latency:
        log_data['latency_seconds'] = round(latency, 3)

    if error:
        log_data['error'] = str(error)

    # Add any additional metadata
    log_data.update(kwargs)

    # Log at appropriate level
    if success:
        logger.info(f"LLM call succeeded: {operation}", extra=log_data)
    else:
        logger.error(f"LLM call failed: {operation}", extra=log_data)


def log_flashcard_generation(logger, operation_type, user_id, input_source,
                             llm_provider, success, flashcards_count=0,
                             tokens=None, latency=None, error=None, **kwargs):
    """
    Log complete flashcard generation operation

    Args:
        logger: Logger instance
        operation_type: Type of operation ("document", "image", "link")
        user_id: User ID
        input_source: Source description (file path, URL, etc.)
        llm_provider: LLM provider used
        success: Whether generation succeeded
        flashcards_count: Number of flashcards generated
        tokens: Token usage dict
        latency: Total operation latency
        error: Error message if failed
        **kwargs: Additional metadata
    """
    log_data = {
        'operation': f'{operation_type}_flashcard_generation',
        'operation_type': operation_type,
        'user_id': user_id,
        'input_source': input_source,
        'llm_provider': llm_provider,
        'success': success,
        'flashcards_count': flashcards_count,
    }

    if tokens:
        log_data['tokens'] = tokens

    if latency:
        log_data['total_latency_seconds'] = round(latency, 3)

    if error:
        log_data['error'] = str(error)

    log_data.update(kwargs)

    if success:
        logger.info(
            f"Flashcard generation completed: {operation_type}, "
            f"{flashcards_count} flashcards, provider: {llm_provider}",
            extra=log_data
        )
    else:
        logger.error(
            f"Flashcard generation failed: {operation_type}",
            extra=log_data
        )
