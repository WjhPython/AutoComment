const puppeteer = require("puppeteer");
const config = require("./config");
const browserMgr = require("./browerMgr");
const utils = require("./utils");


module.exports = new class {

    constructor(){
        this.dataPool = {
            len: 0,
            num: 1,
            parentPage: 1,
            urls: []          
        };
        this.lastRequest = null;  // 用来记录上次的商品链接(标识获取的商品链接一直不变的话，就表示获取完了)
        this.nextPagePool = new Set();  // 分页链接
        this.requestedPagePool = new Set(); // 请求过的链接
    }

    async getDataPool(){
        if (!this.dataPool){
            this.dataPool = {
                len: 0,
                num: 1,
                parentPage: 1,
                urls: []          
            };;
        }

        return this.dataPool;
    }

    async setDataPool(len, pageNum, parentPage, urls){
        this.dataPool.len = len;
        this.dataPool.urls = urls;
        this.dataPool.parentPage = parentPage;
        this.dataPool.num = pageNum;
    }

    async parser(params){
        const browser = await browserMgr.createSingleBrower();
        try {

            // 区分新的请求
            if (this.lastRequest != null){
                await this.setDataPool(0, 1, 1, []);
            }
            this.lastRequest = params.url;
            this.requestedPagePool.add(params.url);

            await this.commentGoods(browser, params);
        } catch (error) {
            console.log("parser=>"+error)
        }

        // 继续遍历分页
        try {
            while(this.nextPagePool.size != 0 ){
                for (let i of this.nextPagePool.values()){
                    console.log("正在打开商店： "+i);
                    // 加入已请求队列
                    this.requestedPagePool.add(i)

                    params.url = i;
                    this.dataPool.urls = [];
                    await this.commentGoods(browser, params);

                    // 加入去重集合
                    this.nextPagePool.delete(i);
                }
            }
        } catch (error) {
            console.log("parser nextPage=>"+error)
        }

        await browser.close();

    }

    async commentGoods(browser, params) {
        const page = await browser.newPage();
    
        // 设置登录cookie
        let cookie = params.cookie;
        let fstpage_cookie = await this.getRandomCookie(params.cookie);
        await page.setExtraHTTPHeaders({ 'Accept-Language' : 'zh-CN,zh;q=0.8,en;q=0.6', 'Cookie': fstpage_cookie});
        try {
            // 跳转商店页面
            await page.goto(params.url);   
        } catch (error) {
            console.log("error: page.goto =>"+error);
        }

        // 获取商店中的商品列表
        let result = await page.evaluate(() => {
            let data = []
            var productsDom = document.querySelectorAll('.link_brand_image');
            if (typeof productsDom[0] == "undefined"){
                productsDom = document.querySelectorAll('.link_category_image');
            }
            for (var element of productsDom){
                let product = element.href;
                if (data.indexOf(product) !=-1){  // 去重
                    continue;
                }
                data.push(product);
            }

            // 获取分页信息
            let nextPage = [];
            let nextPageTree = document.querySelectorAll('.page>a');
            let lastPageTree = document.querySelectorAll('.last>a');
            for (var element of nextPageTree){
                let product = element.href;
                nextPage.push(product);
            }

            let result = {};
            result.goods = data;
            result.nextPages = nextPage;
            for (var element of lastPageTree){
                result.pageNum = element.href;
            }
            return result;

        });

        let products = result.goods;
        for (let nextPage of result.nextPages){
            if (!this.requestedPagePool.has(nextPage)){
                this.nextPagePool.add(nextPage);
            }
        }

        if (config.closePage){
            await this.sleep(1000);
            await page.close();
        }

        // 获取进度条数据
        this.dataPool.num = await utils.findOneString(result.pageNum, /page\/(\d+)/);
        this.dataPool.parentPage = this.requestedPagePool.size;
        this.dataPool.len = products.length;
        for (var i=0; i < products.length; i++){
            let url = products[i];
            // 注意：每个商品页面都需要打开一个浏览器，要不然cookie设置不上，一直用一个账号
            let browser_page = await browserMgr.createBrower();
            let page2 = await browser_page.newPage();
            let random_cookie = await this.getRandomCookie(params.cookie, i);
            try {
                let result = await this.autoComment(page2, params, url, random_cookie, config.waitTimeInterval*1000);
                if (result == false){
                    await page2.close();
                    await browser_page.close();
                    break;
                }
            } catch (error) {

            }
            // 將评论过的url添加到数据池中去
            await this.dataPool.urls.push(url); 

            if (i% config.pageNumber == 0){
                await this.sleep(config.OpenNextPageTime*1000);
            }
            await browser_page.close();
        }
        
        // browser.close();
    }

    // 从cookie池中获取随机cookie或者相应索引下的cookie
    async getRandomCookie(cookies, index){

        if (typeof cookies == "string"){
            return cookies;
        }

        if (!cookies || cookies.length <=0){
            return null;
        }

        if (index != null){
            if (index < cookies.length){
                return cookies[index];
            }
            else{
                return cookies[index%cookies.length];
            }
        }
        return cookies[Math.floor(Math.random()*(cookies.length))];
    }

    async autoComment(page, params, url, cookie, time){
        
        await page.setExtraHTTPHeaders({ 'Accept-Language' : 'zh-CN,zh;q=0.8,en;q=0.6', 'Cookie': cookie})
        // 跳转页面
        await page.goto(url);
        console.log("当前商品页面 => "+url);
        console.log("当前cookie => "+cookie)

        // 睡眠几秒钟
        await this.sleep(time);

        try {
            // 点击提交, 自动评论
            await page.type('[name="comment"]', params.comments);  //config.COMMMENTS[Math.floor(Math.random()*config.COMMMENTS.length)]

            // await page.click('[id="recaptcha-anchor"]');  // 人机验证

            // await this.sleep(2000);  // 等待2秒钟人机验证成功
        
            await page.click('[name="commit"]');

        } catch (error) {
            console.log("评论失败： "+url)
            // 移除评论失败的cookie
            try {
                if (typeof params.cookie == "string"){
                    await page.close();
                    return false;
                }

                if (params.cookie.length <= 0){
                    await page.close();
                    return false;
                }

                params.cookie.splice(params.cookie.indexOf(cookie), 1);
            } catch (error) {
                console.log("移除cookie失败 ");
            }
            
        }
        // if (config.closePage){
        //     await this.sleep(3000);
        //     await page.close();
        // }
        await this.sleep(3000);
        return true;
    }

    async sleep(time){
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            resolve();
          }, time);
        });
    };

}
