"""
LLM Manager with automatic fallback from Gemini to OpenAI
Provides robust flashcard generation with retry logic and comprehensive logging
"""
import os
import time
from typing import Tuple, Dict, List, Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, BaseMessage
from langsmith import traceable
from .logger_config import get_logger, log_llm_call


class LLMManager:
    """
    Manages LLM API calls with automatic fallback and retry logic

    Flow:
    1. Try Gemini with max_retries attempts (exponential backoff)
    2. If Gemini fails, fallback to OpenAI with max_retries attempts
    3. Return response with metadata about which LLM was used
    """

    def __init__(self, user_id: Optional[str] = None, temperature: float = 0.7):
        """
        Initialize LLM Manager with both Gemini and OpenAI clients

        Args:
            user_id: User ID for logging/tracing (optional)
            temperature: Temperature for LLM responses (default: 0.7)
        """
        self.user_id = user_id
        self.temperature = temperature
        self.logger = get_logger(__name__)

        # Initialize Gemini
        try:
            self.gemini_llm = ChatGoogleGenerativeAI(
                model="gemini-2.0-flash-exp",
                google_api_key=os.getenv('GEMINI_API_KEY'),
                temperature=temperature
            )
            self.logger.debug(f"Gemini LLM initialized for user {user_id}")
        except Exception as e:
            self.logger.error(f"Failed to initialize Gemini: {e}")
            self.gemini_llm = None

        # Initialize OpenAI
        try:
            self.openai_llm = ChatOpenAI(
                model="gpt-4o",  # Fast and capable
                api_key=os.getenv('OPENAI_API_KEY'),
                temperature=temperature
            )
            self.logger.debug(f"OpenAI LLM initialized for user {user_id}")
        except Exception as e:
            self.logger.error(f"Failed to initialize OpenAI: {e}")
            self.openai_llm = None

    @traceable(name="llm_call_with_fallback", tags=["llm", "fallback"])
    def call_with_fallback(
        self,
        messages: List[BaseMessage],
        max_retries: int = 3,
        operation_name: str = "flashcard_generation"
    ) -> Tuple[str, str, Dict]:
        """
        Call LLM with automatic Gemini -> OpenAI fallback

        Args:
            messages: List of messages (SystemMessage, HumanMessage, etc.)
            max_retries: Maximum retry attempts per LLM (default: 3)
            operation_name: Name of operation for logging

        Returns:
            Tuple of (response_content, llm_provider, metadata)
            where metadata contains:
                - tokens_used: {input, output, total}
                - latency_seconds: float
                - retries: int
                - fallback_used: bool

        Raises:
            Exception: If both Gemini and OpenAI fail after all retries
        """
        operation_start = time.time()

        # Try Gemini first
        if self.gemini_llm:
            result = self._call_with_retry(
                llm=self.gemini_llm,
                messages=messages,
                max_retries=max_retries,
                operation_name=operation_name,
                provider="gemini"
            )

            if result['success']:
                total_latency = time.time() - operation_start
                result['metadata']['total_latency_seconds'] = round(total_latency, 3)

                # Log successful Gemini call
                log_llm_call(
                    self.logger,
                    operation=operation_name,
                    user_id=self.user_id,
                    llm_provider='gemini',
                    success=True,
                    tokens=result['metadata'].get('tokens_used'),
                    latency=result['metadata']['latency_seconds'],
                    retries=result['metadata']['retries']
                )

                return result['response'], 'gemini', result['metadata']

            # Gemini failed after all retries
            self.logger.warning(
                f"Gemini failed after {max_retries} retries, attempting OpenAI fallback",
                extra={
                    'user_id': self.user_id,
                    'operation': operation_name,
                    'gemini_error': result.get('error')
                }
            )
        else:
            self.logger.warning(
                "Gemini LLM not initialized, using OpenAI directly",
                extra={'user_id': self.user_id}
            )

        # Fallback to OpenAI
        if not self.openai_llm:
            error_msg = "Both Gemini and OpenAI are unavailable"
            self.logger.error(error_msg, extra={'user_id': self.user_id})
            raise Exception(error_msg)

        result = self._call_with_retry(
            llm=self.openai_llm,
            messages=messages,
            max_retries=max_retries,
            operation_name=operation_name,
            provider="openai"
        )

        if result['success']:
            total_latency = time.time() - operation_start
            result['metadata']['total_latency_seconds'] = round(total_latency, 3)
            result['metadata']['fallback_used'] = True

            # Log successful OpenAI fallback
            log_llm_call(
                self.logger,
                operation=operation_name,
                user_id=self.user_id,
                llm_provider='openai',
                success=True,
                tokens=result['metadata'].get('tokens_used'),
                latency=result['metadata']['latency_seconds'],
                retries=result['metadata']['retries'],
                fallback_used=True
            )

            return result['response'], 'openai', result['metadata']

        # Both failed
        error_msg = f"Both Gemini and OpenAI failed: {result.get('error')}"
        log_llm_call(
            self.logger,
            operation=operation_name,
            user_id=self.user_id,
            llm_provider='both',
            success=False,
            error=error_msg
        )
        raise Exception(error_msg)

    def _call_with_retry(
        self,
        llm,
        messages: List[BaseMessage],
        max_retries: int,
        operation_name: str,
        provider: str
    ) -> Dict:
        """
        Internal method to call LLM with exponential backoff retry

        Args:
            llm: LLM instance (Gemini or OpenAI)
            messages: List of messages
            max_retries: Maximum retry attempts
            operation_name: Operation name for logging
            provider: Provider name ("gemini" or "openai")

        Returns:
            Dict with keys:
                - success: bool
                - response: str (if successful)
                - error: str (if failed)
                - metadata: Dict with tokens, latency, retries
        """
        for attempt in range(max_retries):
            try:
                # Start timing
                start_time = time.time()

                # Make the API call
                response = llm.invoke(messages)

                # Calculate latency
                latency = time.time() - start_time

                # Extract token usage
                tokens_used = self._extract_token_usage(response)

                # Log successful attempt
                self.logger.debug(
                    f"{provider.upper()} call succeeded on attempt {attempt + 1}",
                    extra={
                        'user_id': self.user_id,
                        'operation': operation_name,
                        'provider': provider,
                        'attempt': attempt + 1,
                        'latency': round(latency, 3),
                        'tokens': tokens_used
                    }
                )

                return {
                    'success': True,
                    'response': response.content,
                    'metadata': {
                        'tokens_used': tokens_used,
                        'latency_seconds': round(latency, 3),
                        'retries': attempt,
                        'provider': provider,
                        'fallback_used': False
                    }
                }

            except Exception as e:
                error_str = str(e)

                # Check if we should retry
                if attempt < max_retries - 1:
                    # Exponential backoff: 2^attempt seconds (1s, 2s, 4s)
                    wait_time = 2 ** attempt

                    self.logger.warning(
                        f"{provider.upper()} call failed on attempt {attempt + 1}, "
                        f"retrying in {wait_time}s",
                        extra={
                            'user_id': self.user_id,
                            'operation': operation_name,
                            'provider': provider,
                            'attempt': attempt + 1,
                            'error': error_str,
                            'retry_in_seconds': wait_time
                        }
                    )

                    time.sleep(wait_time)
                else:
                    # Final attempt failed
                    self.logger.error(
                        f"{provider.upper()} call failed after {max_retries} attempts",
                        extra={
                            'user_id': self.user_id,
                            'operation': operation_name,
                            'provider': provider,
                            'total_attempts': max_retries,
                            'final_error': error_str
                        }
                    )

                    return {
                        'success': False,
                        'error': error_str,
                        'metadata': {
                            'provider': provider,
                            'retries': attempt,
                            'fallback_used': False
                        }
                    }

        # Should never reach here, but just in case
        return {
            'success': False,
            'error': 'Max retries exceeded',
            'metadata': {'provider': provider, 'retries': max_retries}
        }

    def _extract_token_usage(self, response) -> Dict[str, int]:
        """
        Extract token usage from LLM response

        Args:
            response: LLM response object

        Returns:
            Dict with input_tokens, output_tokens, total_tokens
        """
        tokens = {
            'input_tokens': 0,
            'output_tokens': 0,
            'total_tokens': 0
        }

        try:
            # Try to get usage metadata (format varies by provider)
            if hasattr(response, 'usage_metadata'):
                usage = response.usage_metadata
                tokens['input_tokens'] = usage.get('input_tokens', 0)
                tokens['output_tokens'] = usage.get('output_tokens', 0)
                tokens['total_tokens'] = usage.get('total_tokens', 0)
            elif hasattr(response, 'response_metadata'):
                usage = response.response_metadata.get('token_usage', {})
                tokens['input_tokens'] = usage.get('prompt_tokens', 0)
                tokens['output_tokens'] = usage.get('completion_tokens', 0)
                tokens['total_tokens'] = usage.get('total_tokens', 0)
        except Exception as e:
            self.logger.debug(f"Could not extract token usage: {e}")

        return tokens
