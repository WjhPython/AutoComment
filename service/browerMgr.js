const puppeteer = require('puppeteer'); //引入puppeteer库.
const config = require("./config"); // 引入配置文件


module.exports = new class{
    constructor(){
        this.singleBrowser = null;
        this.browser = null;
    }

    async createSingleBrower(){
        if (this.singleBrowser){
            return this.singleBrowser;
        }
        this.singleBrowser = await puppeteer.launch({
            headless: !config.debug
        });
        console.log("Single Brower launch finsh!");
        return this.singleBrowser
    }

    async createBrower(){
        this.browser = await puppeteer.launch({
            headless: !config.debug
        });
        console.log("Brower launch finsh!");
        return this.browser
    }
}