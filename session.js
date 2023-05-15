class WASession{

    constructor(code, status, role, last_announcement, previous_sticker){
        this.code = code == "000000" ? undefined : code
        this.status = status
	if (previous_sticker == undefined) this.previous_sticker = []
        if (role == undefined) this.role = "default"
        if (last_announcement == undefined) this.last_announcement = "NA"
    }
}

module.exports = {WASession};
