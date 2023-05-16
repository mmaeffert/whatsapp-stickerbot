const { createCanvas, loadImage, registerFont} = require("canvas");
const { create } = require("domain");
const fs = require("fs")

registerFont("./impact.ttf", {"family": 'impact', "font-style": "normal", "font-weight": "normal"})

sFile = "./source-meme.jpg"

function drawText(sFile, position = "top", text, fontColor = "#000"){
    loadImage(sFile).then(img => {
        const canvas = createCanvas(img.width, img.height)
        var ctx = canvas.getContext("2d")
    
        ctx.drawImage(img, 0, 0)
        const rightTextBorder = parseInt(img.width * 0.98)
        const letterWidth =  parseInt(img.width / 20)
        ctx.font = (parseInt(img.width / 12)).toString() + 'px "impact"'
        ctx.textAlign  = "center"
        ctx.fillStyle = fontColor

        var current_width = 0
        var current_line = 0
        const line_height = parseInt(letterWidth * 1.7)
        var words = text.split(" ")

        if(position == "bottom") words = words.reverse()

        var line = ""

        words.forEach(word => {
            if(current_width + word.length * letterWidth > rightTextBorder){
                    ctx.fillText(line, parseInt(img.width * 0.5), parseInt(img.height * (position == "top" ? 0.1 : 0.95)) + current_line * line_height * (position == "bottom" ? -1 : 1))
                    line = word + " "
                    current_width = 0
                    current_line++
            }else{
                if(position == "bottom"){
                    line = word + " " + line
                }else{
                    line += word + " "
                }
            }
            current_width += word.length * letterWidth
            if(word == words[words.length - 1]){
                ctx.fillText(line, parseInt(img.width * 0.5), parseInt(img.height * (position == "top" ? 0.1 : 0.95)) + current_line * line_height * (position == "bottom" ? -1 : 1))
            }
        });
        const out = fs.createWriteStream(sFile + (position == "top" ? "top" : "bottom") + fontColor + ".jpg")
        var stream = canvas.createJPEGStream()
        stream.pipe(out)
        done = false
        out.on("finish", function(){
            console.log("Done")
        })
    })
}

module.exports = {drawText};

