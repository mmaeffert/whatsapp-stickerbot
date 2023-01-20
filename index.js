const qrcode = require('qrcode-terminal');
const WAWebJS = require('whatsapp-web.js');
const fs = require("fs")
const waSession = require("./session")
const sha = require('js-sha256');

const { Client, MessageMedia } = require('whatsapp-web.js');
const client = new Client();
const Message = WAWebJS.Message;

const CONFIG = require('./config.json');

let sessions = {}




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





// When user sends an image
async function evalImage(message){
    try {
        message.downloadMedia().then((image) => {
            fs.writeFile(CONFIG['meme-path']  +  sha(image.data) + ".jpg", 
                image.data, 
                "base64",
                function(error){
                    if(error){
                        return console.log(error)
                    }
                    console.log("image saved from : " + message.from)
                })
        })
        message.reply("Habibi, danke")
    } catch {
        message.reply("❎ Fehlgeschlagen!")
    }
}



// When user asks for a meme
async function approveMeme(message){

    if(sessions[message.from].role != "approver"){
        message.reply("Du bist kein meme approver. Frage den Admin nach dem Passwort")
        return null;
    }

    fs.readdir(CONFIG['meme-path'], (err, files) => {
        if(files.length == 0){
            client.sendMessage(message.from, "Danke bro, aber es gibt aktuell keine memes zum approven")
            return null;
        }
        client.sendMessage(message.from, MessageMedia.fromFilePath(CONFIG['meme-path'] + files[0]))
        client.sendMessage(message.from, files[0].slice(0, -4))
    });
}




// When user reacts to a meme we sent him for approval
async function handleMemeApproval(message){
    feedback = await message.getQuotedMessage()

    if(!feedback){
        client.sendMessage(message.from, "Irgendetwas ist schief gelaufen. Achte darauf, dass du nur auf memes reagieren kannst, die wir dir gesendet haben")
        return null;
    }

    if(!fs.existsSync(CONFIG['meme-path'] + feedback.body + ".jpg")){
        client.sendMessage(message.from, "Das meme existiert nicht mehr oder wurde bereits bewertet. Danke")
        return null;
    }

    if(message.body == "y"){
        fs.rename(CONFIG['meme-path'] + feedback.body + ".jpg", CONFIG['approved-memes'] + feedback.body + ".jpg", (error) => {
            console.log(error)
        })
        fs.unlink(CONFIG['meme-path'] + feedback.body + "jpg", (error) => {
            console.log(error)
        })
        client.sendMessage(message.from, "Danke habibi")
        return null;
    }

    if(message.body == "n"){
        fs.unlink(CONFIG['meme-path'] + feedback.body + "jpg", (error) => {
            console.log(error)
        })
        return null;
    }

    client.sendMessage(mesage.feedback, "Danke habibi")

}





// When user sends a text string that is not predefined like "n" or "y"
async function evalText(message){

    // User reacted to a meme
    if(message.body == "y" || message.body == "n"){
        handleMemeApproval(message);
        return null;
    }

    // User elevates to approver
    if(message.body == CONFIG['approver-secret']){
        sessions[message.from].role = "approver"
        client.sendMessage(message.from, "Du bist jetzt meme approver. Schreibe 'meme' um memes zu erhalten. ANTWORTE AUF DEN CODE DER NACH DEM MEME KOMMT ein meme mit 'y' für approve und 'n' zum löschen")
        return null;
    }

    // User wants to approve meme
    if(message.body == "meme"){
        approveMeme(message)
        return null;
    }

    // Checks if it's a valid code
    if(!isCode(message.body)){
        client.sendMessage(message.from, "Starte deine Bestellung bitte mit dem 6-stelligen Code, der dir auf der Website angezeigt wird")
        return null;
    }
    
    // Checks if folder exists
    if(!fs.existsSync(CONFIG['sticker-path'] + message.body)){
        client.sendMessage(message.from, "Wir haben keine Bestellung gefunden. Besuche https://www.stickemup.de um deinen Code zu erhalten")
        return null;
    }

    console.log("Folder created: " + message.body)
    client.sendMessage(message.from, "Wir haben deinen Code gefunden, du kannst jetzt deine Sticker senden");
    sessions[message.from].role = "active"
    sessions[message.from].code = message.body
    sessions[message.from].status = "open"
}

 




function initSession(author){
    if(!sessions[author]){
        sessions[author] = new waSession.WASession("000000", "init", "default")
    }
}





// When user sends a sticker
async function evalSticker(message){
    
    if(!sessions[message.from]){
        client.sendMessage(message.from, "Bevor du mir Sticker senden kannst, musst du erst deinen Bestellcode genereieren. Besuche dafür https://www.stickemup.de")
        return null;
    }

    if(sessions[message.from].status != "open"){
        client.sendMessage(message.from, "Irgendetwas stimmt mit deinem Code nicht :( Versuche ihn neu zu generieren")
        return null;
    }

    client.sendMessage(message.from, "*[⏳]* Lade runter..");
    try {
        message.downloadMedia().then((sticker) => {
            fs.writeFile(CONFIG['sticker-path'] + sessions[message.from].code + "/" + sha(sticker.data) + ".webp", 
                sticker.data, 
                "base64",
                function(error){
                    if(error){
                        return console.log(error)
                    }
                    console.log("Sticker saved from " + message.from)
                })
        })
        message.reply("✅ Gespeichert!")
    } catch {
        message.reply("❎ Fehlgeschlagen!")
    }
}





client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
});

client.on('ready', () => {
    console.log('Client is ready!');
});






// HIER WIRD DIR NACHRICHT ABGEFANGEN
client.on('message',  message => {
    console.log("NEW MESSAGE from " + message.from + " with type " + message.type + ": '" + message.body + "'")
    initSession(message.from)

    if(!message.hasMedia){
        evalText(message)
    }

    if(message.type == "sticker"){
        evalSticker(message)
    }

    if(message.type == "image"){
        evalImage(message)
    }
});

client.initialize();

 