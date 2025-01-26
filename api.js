// API配置
const API_CONFIG = {
    url: 'https://api.coze.cn/v3/chat',
    botId: '7463068454003261477',
    userId: '123456789',
    token: 'pat_XpF39Oy8DCoazDgaqaGNt6NouJA98MV8C5cQGjOVRMwqRJooKuSmx8fcFJuTtDH8'
};

// DOM元素
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const responseDiv = document.getElementById('response');
const imagePreview = document.getElementById('imagePreview');
const loadingDiv = document.getElementById('loading');

// 显示加载状态
function showLoading() {
    loadingDiv.style.display = 'block';
    imagePreview.style.display = 'none';
    sendButton.disabled = true;
}

// 隐藏加载状态
function hideLoading() {
    loadingDiv.style.display = 'none';
    sendButton.disabled = false;
}

// 显示图片
function displayImage(url) {
    imagePreview.src = url;
    imagePreview.style.display = 'block';
    // 图片加载失败时显示错误信息
    imagePreview.onerror = () => {
        imagePreview.style.display = 'none';
        responseDiv.style.display = 'block';
        responseDiv.textContent = '图片加载失败，请重试';
    };
}

// 处理单个事件对（event + data）
function processEventPair(eventLine, dataLine) {
    try {
        if (!eventLine.startsWith('event:') || !dataLine.startsWith('data:')) {
            return;
        }

        const eventType = eventLine.substring(6).trim();
        const dataStr = dataLine.substring(5).trim();

        if (dataStr === '"[DONE]"') {
            hideLoading();
            return;
        }

        const jsonData = JSON.parse(dataStr);

        if ((eventType === 'conversation.message.delta' || 
             eventType === 'conversation.message.completed') && 
            jsonData.type === 'answer' && 
            jsonData.content) {
            console.log('找到回答:', jsonData.content);
            responseDiv.style.display = 'none';
            displayImage(jsonData.content);
        }
    } catch (error) {
        console.error('处理事件对时出错:', error);
        hideLoading();
    }
}

// 处理流式数据
function processStreamData(chunk) {
    // 将数据按行分割
    const lines = chunk.split('\n').filter(line => line.trim());
    
    // 每两行为一组处理（event行和data行）
    for (let i = 0; i < lines.length - 1; i += 2) {
        const eventLine = lines[i];
        const dataLine = lines[i + 1];
        
        if (eventLine && dataLine) {
            processEventPair(eventLine, dataLine);
        }
    }
}

// 发送消息处理函数
async function sendMessage() {
    // 清空上一次的响应
    responseDiv.textContent = '';
    responseDiv.style.display = 'none';
    imagePreview.style.display = 'none';
    
    // 获取用户输入
    const content = userInput.value.trim();
    if (!content) {
        alert('请输入内容！');
        return;
    }

    // 显示加载状态
    showLoading();

    try {
        // 准备请求数据
        const requestData = {
            bot_id: API_CONFIG.botId,
            user_id: API_CONFIG.userId,
            stream: true,
            auto_save_history: true,
            additional_messages: [
                {
                    role: 'user',
                    content: content,
                    content_type: 'text'
                }
            ]
        };

        // 发起fetch请求
        const response = await fetch(API_CONFIG.url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_CONFIG.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        // 检查响应状态
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // 获取响应的ReadableStream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // 循环读取流数据
        while (true) {
            const {value, done} = await reader.read();
            if (done) {
                hideLoading();
                break;
            }
            
            // 解码数据
            const chunk = decoder.decode(value, {stream: true});
            buffer += chunk;

            // 处理完整的事件对
            if (buffer.includes('\n\n')) {
                const parts = buffer.split('\n\n');
                // 保留最后一个可能不完整的部分
                buffer = parts.pop();
                // 处理完整的部分
                for (const part of parts) {
                    if (part.trim()) {
                        processStreamData(part);
                    }
                }
            }
        }

        // 处理最后剩余的数据
        if (buffer.trim()) {
            processStreamData(buffer);
        }
    } catch (error) {
        console.error('Error:', error);
        responseDiv.style.display = 'block';
        responseDiv.textContent = `发生错误: ${error.message}`;
        hideLoading();
    }
}

// 添加事件监听器
sendButton.addEventListener('click', sendMessage);

// 添加回车发送功能
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
