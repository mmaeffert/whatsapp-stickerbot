const qrcode = require('qrcode-terminal');
const WAWebJS = require('whatsapp-web.js');
const fs = require("fs")
const waSession = require("./session")
const sha = require('js-sha256');
const { Client, MessageMedia } = require('whatsapp-web.js');
const client = new Client();
const Message = WAWebJS.Message;
const CONFIG = require('./config.json');
const path = require('path');
const { unescape } = require('querystring');
const { time } = require('console');

// contains info about each message author
let sessions = {}

bruteForceLog = new Map()


// When user asks for a meme
async function approveMeme(message){
    client.sendMessage(message.from, "Die Funktion wird aktuell noch implementiert :(")
    // if(sessions[message.from].role != "approver"){
    //     message.reply("Du bist kein meme approver. Frage den Admin nach dem Passwort")
    //     return null;
    // }

    // fs.readdir(CONFIG['meme-path'], (err, files) => {
    //     if(files.length == 0){
    //         client.sendMessage(message.from, "Danke bro, aber es gibt aktuell keine memes zum approven")
    //         return null;
    //     }
    //     client.sendMessage(message.from, MessageMedia.fromFilePath(CONFIG['meme-path'] + files[0]))
    //     client.sendMessage(message.from, files[0].slice(0, -4))
    // });
}

// When user sends a text string that is not predefined like "n" or "y"
async function handleCode(message){

    const dir = CONFIG['base-path'] + CONFIG['sticker-path'] + message.body

    // Checks if folder exists
    if(!fs.existsSync(CONFIG['base-path'] + CONFIG['sticker-path'] + message.body)){
        client.sendMessage(message.from, "Wir haben keine Bestellung gefunden. Besuche https://www.stickemup.de um deinen Code zu erhalten")
        return null;
    }

    const sessionWasUsedBefore = (fs.readdirSync(dir + "/" + CONFIG['sticker-file-location']).length != "")


    sessions[message.from].role = "active"
    sessions[message.from].code = message.body
    sessions[message.from].status = "open"
    log("Code " + message.body + " was registered")

    if(!sessionWasUsedBefore){
        client.sendMessage(message.from, "Wir haben deinen Code gefunden, du kannst jetzt deine Sticker senden");
        return;
    }

    client.sendMessage(message.from, "Es wurden bereits Sticker zu diesem Code gefunden. Möchtest du sie löschen und neu starten? Dann *antworte auf diese Nachricht* mit einem 'y'. Ansonsten kannst du jetzt einfach weiter Sticker senden")
}




function isCode(_code){
    const availableChars = "aAbBcCdDeEfFgGhHiIjJkKlLmMnNoOpPqQrRsStTuUvVwWxXyYzZ"
    let code_legit = true;

    if(_code.length != 6){
        code_legit = false;
    }

    for (var i = 0; i < _code.length; i++) {
        if(!availableChars.includes(_code[i])){
            code_legit = false
        }
    }

    return code_legit;
}




// Opens a session for a user if it does not exist yet
function initSession(author){
    if(!sessions[author]){
        sessions[author] = new waSession.WASession("000000", "init", "default")
    }
}




// When user sends an image
async function evalImage(message){
    try {
        message.downloadMedia().then((image) => {
            message.reply(image, message.from, {
                sendMediaAsSticker: true,
            });
        })
    } catch {
        message.reply("❌ Fehlgeschlagen!")
    }
}




// When user reacts to a meme we sent him for approval
async function handleApproval(message){
    feedback = await message.getQuotedMessage()

    // When user wants to delete sticker from already existing session
    if(feedback.body.startsWith("Es wurden bereits Sticker") && message.body === "y"){
        const dir = CONFIG['base-path'] + CONFIG['sticker-path'] + sessions[message.from].code + "/" + CONFIG['sticker-file-location']

        fs.readdirSync(dir).forEach((file) => {
            fs.unlink(dir + file, (error) => {
                if(error){
                    log("Error while deleting " + dir + " : " + error, message.from)
                    client.searchMessages(message.from, "Es ist ein Fehler unterlaufen :(")
                    return;
                }
            })
        })
        client.sendMessage(message.from, "Es wurden alle zuvor gespeicherten Sticker gelöscht")
        return;
    }

    if(!feedback){
        client.sendMessage(message.from, "Irgendetwas ist schief gelaufen. Achte darauf, dass du nur auf memes reagieren kannst, die wir dir gesendet haben")
        return null;
    }

    client.sendMessage(mesage.feedback, "Danke habibi")
}




// When user sends a sticker
async function evalSticker(message){

    if(!sessions[message.from]){
        client.sendMessage(message.from, "Bevor du mir Sticker senden kannst, musst du erst deinen Bestellcode generieren. Besuche dafür https://www.stickemup.de")
        return null;
    }

    if(sessions[message.from].status != "open"){
        client.sendMessage(message.from, "Etwas stimmt mit deinem Code nicht :( Versuche ihn neu zu generieren")
        return null;
    }

    try {
        message.downloadMedia().then((sticker) => {

            if(unescape(atob(sticker.data)).length > 100000){
                client.sendMessage(message.from, "Der Sticker ist zu groß. Bitte sende keine Videos")
                return null
            }

            createWhatsappSticherFileDirectory(sessions[message.from].code).then(
                
                fs.writeFile(CONFIG['base-path'] + CONFIG['sticker-path'] + sessions[message.from].code + "/" + CONFIG['sticker-file-location'] + sha(sticker.data) + ".webp",
                sticker.data,
                "base64",
                function(error){
                    if(error){
                        return log("WHILE DOWNLOADING STICKER: " + error)
                    }
                    log("Sticker saved", message.from)
                }),
                message.reply("✅ Gespeichert!")
            )
        })
    } catch {
        message.reply("❌ Fehlgeschlagen!")
    }
}


async function createWhatsappSticherFileDirectory(code){
    dir = CONFIG['base-path'] + CONFIG['sticker-path'] + code + "/" + CONFIG['sticker-file-location']

    if(!fs.existsSync(dir)){
        fs.mkdirSync(dir)
    }
}


// Elevates a user to meme approver. The user then can use the "meme" command
function elevateUser(message){
    sessions[message.from].role = "approver"
    client.sendMessage(message.from, "Du bist jetzt meme approver. Schreibe 'meme' um memes zu erhalten. ANTWORTE AUF DEN CODE DER NACH DEM MEME KOMMT ein meme mit 'y' für approve und 'n' zum löschen")
    return null;
}



// Place your commands here and link it to a function
const router = {
    "meme": approveMeme,
    "y": handleApproval,
    "n": handleApproval,
    "sticker": evalSticker,
    "image": evalImage,
}





// Dispatches the command to the according function
function dispatcher(message){

    if(router[message.body]) return router[message.body](message)
    if(router[message.type]) return router[message.type](message)
    if(isCode(message.body)) return handleCode(message)
    if(message.body == CONFIG["approver-secret"]) return elevateUser(message)
    client.sendMessage(message.from, "Starte deine Bestellung bitte mit dem 6-stelligen Code, der dir auf der Website angezeigt wird")

}

function getTime(date){
    return date.getHours() + "-" + date.getMinutes() + "-" + date.getSeconds()
}


function checkBruteForce(message){
    if(!bruteForceLog.has(message.from)){
        bruteForceLog.set(message.from, [Date.now()])
    }

    console.log("bruteforcelog at beginning: " + bruteForceLog)
    var userLog = bruteForceLog.get(message.from)
    console.log("userlog: " + userLog)
    console.log("userlog type: " + typeof userLog)

    userLog = userLog.filter(timestamp => {
        return ((Date.now() - timestamp) < (CONFIG['bruteforce-timeframe-in-minutes']*60*1000))
    })
    console.log("filtered userLOG: " + userLog)
    userlog = userLog.push(Date.now())
    console.log("new userlog: " + userLog)

    bruteForceLog.set(message.from, userLog)
    console.log("bruteforcelog at end: " + bruteForceLog)
}

async function log(content, author){
    var today = new Date();
    var dd = String(today.getDate()).padStart(2, '0');
    var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
    var yyyy = today.getFullYear();
    todayString = mm + '-' + dd + '-' + yyyy;

    const logFilePath = CONFIG['log-file'] + todayString
    try{
        fs.createWriteStream(logFilePath, {flags:'a'}).write("[" + getTime(today) + "] " + (author === undefined ? "" : author + "  ") + content + "\n")
    }catch(error){
        console.log(error)
    }
}

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
});

client.on('ready', () => {
    log('Client is ready!');
});

// HIER WIRD DIR NACHRICHT ABGEFANGEN
client.on('message',  message => {
    if(checkBruteForce(message)){
        log("NEW MESSAGE from with type " + message.type + " -messagebody: '" + message.body + "'", message.from)
        initSession(message.from)
        dispatcher(message)
    }
});

client.initialize();
