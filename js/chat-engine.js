/* DKU Tarot - Chat Engine (OpenAI SSE Streaming) */
const ChatEngine = (() => {
  let conversationHistory = [];
  let messagesContainer = null;
  let inputTextarea = null;
  let sendButton = null;
  let currentController = null;
  let isStreaming = false;

  function init(elements) {
    messagesContainer = elements.messagesContainer;
    inputTextarea = elements.inputTextarea;
    sendButton = elements.sendButton;

    sendButton.addEventListener('click', handleSend);
    inputTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    // Auto-resize textarea
    inputTextarea.addEventListener('input', () => {
      inputTextarea.style.height = 'auto';
      inputTextarea.style.height = Math.min(inputTextarea.scrollHeight, 120) + 'px';
    });
  }

  function setSystemPrompt(prompt) {
    conversationHistory = [{ role: 'system', content: prompt }];
  }

  function addAssistantMessage(content) {
    conversationHistory.push({ role: 'assistant', content });
    renderMessage('assistant', content);
  }

  function addHiddenUserMessage(content) {
    // Added to history but NOT rendered in UI
    conversationHistory.push({ role: 'user', content });
  }

  function renderMessage(role, content) {
    const msgEl = document.createElement('div');
    msgEl.className = `chat-message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.innerHTML = role === 'assistant'
      ? '<span class="material-icons">auto_awesome</span>'
      : '<span class="material-icons">person</span>';

    const bubble = document.createElement('div');
    bubble.className = 'msg-content';
    bubble.innerHTML = typeof marked !== 'undefined' ? marked.parse(content) : content;

    msgEl.appendChild(avatar);
    msgEl.appendChild(bubble);
    messagesContainer.appendChild(msgEl);
    scrollToBottom();

    return bubble;
  }

  function renderError(message) {
    const errorEl = document.createElement('div');
    errorEl.className = 'chat-error';
    errorEl.textContent = message;
    messagesContainer.appendChild(errorEl);
    scrollToBottom();
  }

  function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    messagesContainer.appendChild(indicator);
    scrollToBottom();
    return indicator;
  }

  function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
  }

  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function handleSend() {
    const text = inputTextarea.value.trim();
    if (!text || isStreaming) return;

    // Add user message
    conversationHistory.push({ role: 'user', content: text });
    renderMessage('user', text);

    // Clear input
    inputTextarea.value = '';
    inputTextarea.style.height = 'auto';

    // Send to API
    streamResponse();
  }

  async function streamResponse() {
    const config = Config.getAll();

    if (!config.apiKey) {
      renderError('Please configure your API key in Settings (gear icon) to start chatting.');
      return;
    }

    isStreaming = true;
    sendButton.disabled = true;

    const indicator = showTypingIndicator();
    currentController = new AbortController();

    try {
      const response = await fetch(config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: conversationHistory,
          stream: true,
        }),
        signal: currentController.signal,
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`API error ${response.status}: ${errBody.slice(0, 200)}`);
      }

      removeTypingIndicator();

      // Create assistant message bubble for streaming
      const bubble = renderMessage('assistant', '');
      let fullContent = '';

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') continue;

          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              bubble.innerHTML = typeof marked !== 'undefined'
                ? marked.parse(fullContent)
                : fullContent;
              scrollToBottom();
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }

      // Save full response to history
      conversationHistory.push({ role: 'assistant', content: fullContent });

    } catch (err) {
      removeTypingIndicator();
      if (err.name !== 'AbortError') {
        renderError(err.message);
      }
    } finally {
      isStreaming = false;
      sendButton.disabled = false;
      currentController = null;
    }
  }

  // Trigger a response without user input (e.g., after cards flipped)
  function triggerAutoResponse() {
    streamResponse();
  }

  function cancelStream() {
    if (currentController) {
      currentController.abort();
    }
  }

  return {
    init,
    setSystemPrompt,
    addAssistantMessage,
    addHiddenUserMessage,
    renderMessage,
    renderError,
    triggerAutoResponse,
    cancelStream,
  };
})();
