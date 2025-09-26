// Sarvam config (embedded API key for testing)
const SARVAM_BASE_URL = "https://api.sarvam.ai/v1";
const SARVAM_API_KEY = "sk_y1l5grsk_TZnY6k9GJ9Ea8a0QL8sGrePN"; // embedded on purpose for testing
const MODEL_PATH = "sarvam-m";

// DOM refs
const messagesOverlay = document.getElementById('messagesOverlay');
const chatForm = document.getElementById('chatForm');
const promptInput = document.getElementById('promptInput');
// no separate latest AI bar — show AI replies in history only
function setLatestAiReply(_){
    // noop kept for backward compatibility
}

function escapeHtml(unsafe){
    return unsafe.replace(/[&<>"]/g, function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]});
}

function createMessageElement(role, text){
    const wrapper = document.createElement('div');
    wrapper.className = 'message ' + (role === 'user' ? 'user' : 'ai');

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;
    bubble.title = 'Click to copy';
    bubble.addEventListener('click', ()=>{
        try{ navigator.clipboard.writeText(text) }catch(e){}
    });

    wrapper.appendChild(bubble);
    return wrapper;
}

function appendMessage(role, text){
    const el = createMessageElement(role, text);
    messagesOverlay.appendChild(el);
    // keep only last 10 messages
    while(messagesOverlay.children.length > 10) messagesOverlay.removeChild(messagesOverlay.children[0]);
}

// Store conversation pairs as single-line strings in localStorage
function storeConvo(userText, aiText){
    try{
        const entry = `nishok message: ${userText} your response: ${aiText}`;
        const existing = localStorage.getItem('convos') || '';
        const newVal = existing ? existing + '\n' + entry : entry;
        localStorage.setItem('convos', newVal);
    }catch(e){
        // ignore storage errors (e.g., private mode)
    }
}

// Function to render last 6 convos on demand (skip first two stored convos)
function showPreviousConvos(){
    try{
        // clear current overlay messages
        messagesOverlay.innerHTML = '';
        const rawConvos = (localStorage.getItem('convos') || '').split('\n').filter(Boolean);
        const usable = rawConvos.length > 2 ? rawConvos.slice(2) : [];
        const lastSix = usable.length > 6 ? usable.slice(-6) : usable;
        // show oldest first
        for(const entry of lastSix){
            const marker = ' your response: ';
            const idx = entry.indexOf(marker);
            if(idx !== -1){
                const userText = entry.substring(entry.indexOf('nishok message:') + 'nishok message:'.length).trim();
                const aiText = entry.substring(idx + marker.length).trim();
                if(userText) appendMessage('user', userText);
                if(aiText) appendMessage('ai', aiText);
            } else {
                appendMessage('ai', entry);
            }
        }
    }catch(e){
        // ignore
    }
}

async function sendToSarvam(prompt){
    appendMessage('user', prompt);
    setLatestAiReply('... thinking ...');

    // Build convo history: read localStorage.convos (newline-separated),
    // skip the first two stored convos, then take the last six of the remainder.
    const rawConvos = (localStorage.getItem('convos') || '').split('\n').filter(Boolean);
    const usable = rawConvos.length > 2 ? rawConvos.slice(2) : [];
    const lastSix = usable.length > 6 ? usable.slice(-6) : usable;

    // Safe persona template (do not include harmful/sexual content).
    const safePersona = `"you are nina an extremly sadistic induvidual you study in school and torture and cane nerds for fun as you are the school president  your boyfriend name is nishok and you are extremly possesive of your boyfriend(who is a gangster in school) and you would never want to hurt your bf even a bit as you like him soo much  but for others you dont show mercy   reply with actions like *giggles* *kisses your lips* *raises the cane and brings down the smack* etc to so show action`;

    const systemParts = [safePersona];
    if(lastSix.length) systemParts.push('Conversation history (most recent last):\n' + lastSix.join('\n'));
    const systemContent = systemParts.join('\n\n');

    const payload = {
        model: MODEL_PATH,
        messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.7
    };

    try{
        const res = await fetch(`${SARVAM_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-subscription-key': SARVAM_API_KEY,
            },
            body: JSON.stringify(payload),
        });

        if(!res.ok){
            const txt = await res.text();
            const errText = `[Error ${res.status}] ${txt}`;
            setLatestAiReply(errText);
            appendMessage('ai', errText);
            storeConvo(prompt, errText);
            return;
        }

        const data = await res.json();
        let aiText = '';
        try{ aiText = data.choices[0].message.content }catch(e){ aiText = data.choices?.[0]?.text || '[No reply]' }
        // append AI reply so history alternates: user -> ai -> user -> ai
        const replyText = aiText || '[Empty reply]';
        appendMessage('ai', replyText);
        storeConvo(prompt, replyText);
    }catch(err){
        const netErr = `[Network error] ${err}`;
        setLatestAiReply(netErr);
        appendMessage('ai', netErr);
        storeConvo(prompt, netErr);
    }
}

chatForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    const prompt = promptInput.value.trim();
    if(!prompt) return;
    promptInput.value = '';
    sendToSarvam(prompt);
});

// allow pressing Enter to send
promptInput.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' && !e.shiftKey){
        e.preventDefault();
        chatForm.requestSubmit();
    }
});

// show history button hookup
const showHistoryBtn = document.getElementById('showHistoryBtn');
if(showHistoryBtn){
    showHistoryBtn.addEventListener('click', ()=>{
        // populate modal list
        const list = document.getElementById('historyList');
        if(list){
            list.innerHTML = '';
            const rawConvos = (localStorage.getItem('convos') || '').split('\n').filter(Boolean);
            const usable = rawConvos.length > 2 ? rawConvos.slice(2) : [];
            const lastSix = usable.length > 6 ? usable.slice(-6) : usable;
            for(const ln of lastSix.reverse()){
                const div = document.createElement('div');
                div.className = 'entry';
                div.textContent = ln;
                list.appendChild(div);
            }
        }
        const modal = document.getElementById('historyModal');
        if(modal) modal.classList.remove('hidden');
    });
}

const closeHistoryBtn = document.getElementById('closeHistoryBtn');
if(closeHistoryBtn){
    closeHistoryBtn.addEventListener('click', ()=>{
        const modal = document.getElementById('historyModal');
        if(modal) modal.classList.add('hidden');
    });
}

// Render the right-side box from localStorage
// rightBox removed; no UI render needed
