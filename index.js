const qrcode = require('qrcode-terminal');
const WAWebJS = require('whatsapp-web.js');
const fs = require("fs")
const waSession = require("./session")
const sha = require('js-sha256');
const { Client, MessageMedia, LocalAuth  } = require('whatsapp-web.js');
const Message = WAWebJS.Message;
const CONFIG = require('./config.json');
const path = require('path');
const { unescape } = require('querystring');
const { time } = require('console');
const atob = require("atob");
const { platform } = require('os');
const { publicEncrypt } = require('crypto');
const fsPromises = require("fs").promises;

// contains info about each message author
let sessions = {}
let sessionData;
if(fs.existsSync(CONFIG['session-file'])) {
    sessionData = require(CONFIG['session-file']);
}

const client = new Client({
    authStrategy: new LocalAuth()
});

bruteForceLog = new Map()


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

    if(sessions[message.from] && isCode(message.body) && message.body != sessions[message.from].code){
	sessions[message.from].previous_sticker = []
    }

    if(!sessionWasUsedBefore && isCode(message.body)){
        client.sendMessage(message.from, "Wir haben deinen Code gefunden, du kannst jetzt deine Sticker senden");
        return;
    }

    client.sendMessage(message.from, "Es wurden bereits Sticker zu diesem Code gefunden. Möchtest du sie löschen und neu starten? Dann *antworte auf diese Nachricht* mit einem 'y'. Ansonsten kannst du jetzt einfach weiter Sticker senden")
}

async function changeFilePermission(path){

    // if on windows, then cancel
    if(process.platform == "win32"){
        return
    }

    try{
        const file = fs.openSync(path, "r");

        fs.fchmod(file, CONFIG['sticker-file-permission'], err =>{
            if(err){
                log("[ERROR] could not change permission (" + CONFIG['sticker-file-permission'] + ") of file: " + path)
            }else{
                log("changed permission (" + CONFIG['sticker-file-permission'] + ") of file: " + path + " with error: " + err)
            }
        })

        fs.fchown (file, CONFIG['sticker-file-owner-uid'], CONFIG['sticker-file-owner-guid'], err =>{
            if(err){
                log("[ERROR] could not change owner (" + CONFIG['sticker-file-owner-uid'] + ") of file: " + path + " with error: " + err)
            }else{
                log("changed owner (" + CONFIG['sticker-file-permission'] + ") of file: " + path + " to " + CONFIG['sticker-file-owner-uid'] + " and group " + CONFIG['sticker-file-owner-guid'])
            }
        })
    }catch (error){
        log("[ERROR] " + error)
    }

    
}

function isCode(_code){
    const availableChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"
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
            log("Converted image to sticker", message.from),
            message.reply(image, message.from, {
                sendMediaAsSticker: true,
            }).then(() => {
                client.sendMessage(message.from, "LMAO guter sticker")            
            });
        })
    } catch {
        log("[ERROR] converting image to sticker", message.from)
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

function fileSizeAllowed(data, maxSize = 200000){
    if(!data) return false

    filePath = CONFIG['base-path'] + CONFIG['sticker-path'] + "temp/" + sha(data) + ".webp"
    log("filepath:" + filePath)
    fs.writeFile(
        filePath, 
        data,
        "base64",
        (err) => {
            if(err){
                log("[ERROR] WHILE DOWNLOADING STICKER: " + err, message.from)
                return false
            }else{
                fs.stat(
                    filePath,
                    (err, stats) => {
                        if (err) {
                            log(`[ERROR] File doesn't exist: ` + filePath)
                            return false
                        } else {
                            fs.unlink(filePath, (error) => {
                                if(error){
                                    log("Error while deleting " + dir + " : " + error, message.from)
                                }
                            })
                            log("statsize: " + stats.size)
                            log("maxSize: " + maxSize)
                            log(stats.size <= maxSize)

                            return stats.size <= maxSize 
                        }
                    }
                )
            }
        }
    )
}

// When user sends a sticker
async function evalSticker(message){

    if(!sessions[message.from]){
        client.sendMessage(message.from, "Bevor du mir Sticker senden kannst, musst du erst deinen Bestellcode generieren. Besuche dafür https://www.stickem.shop")
        return null;
    }

    if(!sessions[message.from].status || sessions[message.from].status != "open"){
        client.sendMessage(message.from, "Starte deine Bestellung auf https://stickem.shop und kopiere den Code von der Website in diesen Chat")
        return null;
    }

    try {
        message.downloadMedia().then((sticker) => {

            if(!fileSizeAllowed(sticker.data, CONFIG['max-sticker-size-in-bytes'])){
                client.sendMessage(message.from, "Der Sticker ist zu groß. Bitte sende keine Videos")
                return
            }

//	    log(JSON.stringify(sessions[message.from]))
//	    if(sessions[message.from].previous_sticker.includes(sha(sticker.data))){
//		client.sendMessage(message.from, "Den Sticker hast du schon eingereicht :)")
//		return null
//	    }

            createWhatsappSticherFileDirectory(sessions[message.from].code).then((result) => {

                //If could not create directory
                if(result === false){
                    log("[ERROR] creating directory", message.from)
                    message.reply("Es gab einen Fehler, wir suchen bereits nach der Lösung. Versuche es in der Zwischenzeit mit einem anderen Sticker")
                    return
                }

                const stickerdir = CONFIG['base-path'] + CONFIG['sticker-path'] + sessions[message.from].code + "/" + CONFIG['sticker-file-location'] + sha(sticker.data) + ".webp"
                fs.writeFile(stickerdir,
                sticker.data,
                "base64",
                (err) => {
                    if(err){
                        return log("[ERROR] WHILE DOWNLOADING STICKER: " + err, message.from)
                    }else{
			sessions[message.from].previous_sticker.push(sha(sticker.data))
                        changeFilePermission(stickerdir)
                        log("Sticker saved", message.from)
                        message.reply("✅ Gespeichert!")
                    }
                })
            }
            )
        })
    } catch {
        message.reply("❌ Fehlgeschlagen!")
        log("[ERROR] while downloading media from sticker", message.from)
    }
}


async function createWhatsappSticherFileDirectory(code){
    dir = CONFIG['base-path'] + CONFIG['sticker-path'] + code + "/" + CONFIG['sticker-file-location']
    try{
        if(!fs.existsSync(dir)){
            fs.mkdirSync(dir)
        }
    }catch(error){
        if(error){
            log("[ERROR] creating path: " + dir)
        }
    }
}


// Elevates a user to meme approver. The user then can use the "meme" command
function elevateUser(message){
    log("Elevated user", message.from)
    sessions[message.from].role = "approver"
    client.sendMessage(message.from, "Du bist jetzt meme approver. Schreibe 'meme' um memes zu erhalten. ANTWORTE AUF DEN CODE DER NACH DEM MEME KOMMT ein meme mit 'y' für approve und 'n' zum löschen")
    return null;
}


// Place your commands here and link it to a function
const router = {
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


function loadSessions(){
    log("trying to load session")
    if (fs.existsSync(CONFIG['log-file'] + 'session.json')) {
        fs.readFile(CONFIG['log-file'] + "session.json", function (error, content) {
            sessions = JSON.parse(content);
            log("Found sessions:\n" + content)
        });
    }
}

async function persistSession(){
        log("writing sessions.json")
        fs.writeFile("./session.json", JSON.stringify(sessions), function(err) {
            if(err) {
                log(err);
            }else{
                log("Saved Session")
            }
        });
}
function checkForAnnouncement(message){
    if(sessions[message.from].last_announcement != CONFIG['last-announcement']){
        client.sendMessage(message.from, CONFIG['last-announcement'])
        sessions[message.from].last_announcement = CONFIG['last-announcement']
    }
    return
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
    loadSessions();
    setInterval(function(){
        log("writing sessions.json")
        fs.writeFile(CONFIG['log-file'] + "session.json", JSON.stringify(sessions), function(err) {
            if(err) {
                log(err);
            }else{
                log("Saved Session")
            }
        });
    } ,60000)
   client.sendMessage(CONFIG['admin-chat-id'], "Bot just restarted")
});

// HIER WIRD DIR NACHRICHT ABGEFANGEN
client.on('message',  message => {
    if(message.from == CONFIG['admin-chat-id']) return
	log("NEW MESSAGE from with type " + message.type + " -messagebody: '" + message.body + "'", message.from)
        initSession(message.from)
        checkForAnnouncement(message)
        dispatcher(message)
});

client.initialize();

