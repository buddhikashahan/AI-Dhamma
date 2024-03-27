const express = require('express');
const fs = require('fs');
const {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    jidNormalizedUser,
    getContentType
} = require('@adiwajshing/baileys');
const P = require('pino');
const translate = require('translate');
const fetch = require('node-fetch');

const app = express();
const port = 3000;

const prefix = '.';
const owner = ['94766866297'];

// Function to load chat history from a JSON file
function loadChatHistory() {
    try {
        const data = fs.readFileSync('chatHistory.json', 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading chat history file:', err);
        return {};
    }
}

// Function to save chat history to a JSON file
function saveChatHistory(chatHistory) {
    try {
        fs.writeFileSync('chatHistory.json', JSON.stringify(chatHistory), 'utf8');
    } catch (err) {
        console.error('Error writing chat history file:', err);
    }
}

async function connectToWA() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
    const conn = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        generateHighQualityLinkPreview: true,
        auth: state,
    });

    const chatHistory = loadChatHistory();

    conn.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            console.log('Connection closed. Last disconnect reason:', lastDisconnect.reason);
            if (lastDisconnect.error) {
                console.error('Last disconnect error:', lastDisconnect.error);
            }

            if (lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut) {
                console.log('Attempting to reconnect...');
                connectToWA();
            }
        } else if (connection === 'open') {
            console.log('Bot Connected ✅');
        }
    });
    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('messages.upsert', async (mek) => {
        try {
            mek = mek.messages[0];
            if (!mek.message) return;
            mek.message = (getContentType(mek.message) === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;
            if (mek.key && mek.key.remoteJid === 'status@broadcast') return;
            const type = getContentType(mek.message);
            const content = JSON.stringify(mek.message);
            const from = mek.key.remoteJid;

            const body = (type === 'conversation') ? mek.message.conversation : (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text : (type == 'imageMessage') && mek.message.imageMessage.caption ? mek.message.imageMessage.caption : (type == 'listResponseMessage') && mek.message.listResponseMessage.singleSelectReply.selectedRowId ? mek.message.listResponseMessage.singleSelectReply.selectedRowId : (type == 'buttonsResponseMessage') && mek.message.buttonsResponseMessage.selectedButtonId ? mek.message.buttonsResponseMessage.selectedButtonId : (type == "templateButtonReplyMessage") && mek.message.templateButtonReplyMessage.selectedId ? mek.message.templateButtonReplyMessage.selectedId : (type == 'videoMessage') && mek.message.videoMessage.caption ? mek.message.videoMessage.caption : '';

            const isCmd = body.startsWith(prefix);
            const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';

            const args = body.trim().split(/ +/).slice(1);
            const q = args.join(' ');
            const isGroup = from.endsWith('@g.us');
            const sender = mek.key.fromMe ? (conn.user.id.split(':')[0] + '@s.whatsapp.net' || conn.user.id) : (mek.key.participant || mek.key.remoteJid);
            const senderNumber = sender.split('@')[0];
            const botNumber = conn.user.id.split(':')[0];
            const pushname = mek.pushName || 'Sin Nombre';

            const isMe = botNumber.includes(senderNumber);
            const isOwner = owner.includes(senderNumber) || isMe;

            const reply = (teks) => {
                conn.sendMessage(from, { text: teks }, { quoted: mek });
            };
            const groupMetadata = mek.isGroup ? await conn.groupMetadata(mek.chat).catch(e => { }) : '';
            const groupName = mek.isGroup ? groupMetadata.subject : '';
            const participants = mek.isGroup ? await groupMetadata.participants : '';
            const groupAdmins = mek.isGroup ? await participants.filter(v => v.admin !== null).map(v => v.id) : '';
            const groupOwner = mek.isGroup ? groupMetadata.owner : '';
            const isBotAdmins = mek.isGroup ? groupAdmins.includes(botNumber) : false;
            const isAdmins = mek.isGroup ? groupAdmins.includes(mek.sender) : false;
            let isEn = true;
            const sinhala = [
                "අ", "ආ", "ඇ", "ඈ", "ඉ", "ඊ", "උ", "ඌ", "ඍ", "ඎ", "ඏ", "ඐ", "එ", "ඒ", "ඓ", "ඔ", "ඕ", "ඖ","ක", "ඛ", "ග", "ඝ", "ඞ", "ඟ", "ච", "ඡ", "ජ", "ඣ","ඤ", "ඥ", "ඦ", "ට", "ඨ", "ඩ", "ඪ", "ණ", "ඬ", "ත", "ථ", "ද", "ධ", "න", "ඳ", "ප", "ඵ", "බ", "භ", "ම", "ඹ", "ය", "ර", "ල", "ව", "ශ", "ෂ", "ස", "හ", "ළ", "ෆ"
            ];

            for (let i = 0; i < body.length; i++) {
                if (sinhala.includes(body[i])) {
                    isEn = false;
                    break;
                }
            }

            // Only execute this block if conditions are met
            if (!(senderNumber == '94707344725') && !(senderNumber == '94777344725') && !(senderNumber == botNumber) && !isCmd) {
                conn.sendPresenceUpdate('composing', from)
                let text = ''
                if (isEn) {
                    text = body;
                } else {
                    text = await translate(body, { from: 'si' }, { to: 'en' });
                }


                fetch('https://api.botsonic.ai/v1/botsonic/generate', {
                    method: 'POST',
                    headers: {
                        'Accept: 'gzip, deflate',
                        'Connection': 'keep-alive',
                        'Content-Type': 'application/json',
                        'User-Agent': 'python-requests/2.28.1',
                        'accept': 'application/json',
                        'token': '3a25bb10-4a64-4c27-9e78-1089ad32453b'
                    },
                    body: JSON.stringify({
                        'input_text': text,
                        'chat_id': '550e8400-e29b-41d4-a716-0' + senderNumber,
                        'chat_history': chatHistory[from] || []
                    })
                })
                    .then(response => response.json())
                    .then(async data => {
                        conn.sendPresenceUpdate('available', from)
                        if (isEn) {
                            reply(data.answer);
                        } else {
                            const answer = await translate(data.answer, { to: 'si' })
                            reply(answer);
                        }
                        if (!chatHistory[from]) {
                            chatHistory[from] = [];
                        }
                        chatHistory[from].push(data.chat_history[data.chat_history.length - 2], data.chat_history[data.chat_history.length - 1]);
                        saveChatHistory(chatHistory); // Save chat history to file
                    })
                    .catch(error => console.error('Error:', error));
            }
            switch (command) {
                case 'jid':
                    reply(from);
                    break
                case 'reset':
                    chatHistory[from] = [];
                    saveChatHistory(chatHistory); // Save chat history to file
                    reply('Chat history restted. Let\'s start a new chat!')
                    break;
                default:
                    if (isOwner && body.startsWith('>')) {
                        try {
                            await reply(util.format(await eval(`(async () => {${body.slice(1)}})()`)))
                        } catch (e) {
                            await reply(util.format(e))
                        }
                    }
            }
        } catch (e) {
            const isError = String(e)
            console.log(isError)
        }
    })
}

// Express route to handle incoming WhatsApp messages
app.post('/webhook', (req, res) => {
    // Handle incoming WhatsApp messages here
    res.send('Received WhatsApp message!');
});

// Start the Express server
app.listen(port, () => {
    console.log(`Express server is listening on port ${port}`);
});

// Connect to WhatsApp
connectToWA();

