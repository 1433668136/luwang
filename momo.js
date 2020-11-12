"ui";
device.keepScreenOn();
var width = device.width;
var height = device.height;
ui.layout(
    <ScrollView bg="#ADD8E6">
        <vertical>
            <horizontal>
                <text textSize="12sp" textColor="black" text="请输入最低价格:" />
                <input id="zdjg" inputType="number" singleLine="true" text="" w="*" />
            </horizontal>

            <horizontal>
                <text textSize="16sp" color="black" text='乘机人数选择:'></text>
                <spinner id="sp1" entries="1|2|3|4|5" />
            </horizontal>

            <horizontal>
                <text textSize="12sp" textColor="black" text="请输入抢票的日期号数(如:10.12 输入12):" />
                <input id="qpsj" inputType="number" singleLine="true" text="" w="*" />
            </horizontal>

            <horizontal>
                <text textSize="12sp" textColor="black" text="请输入卡密:" />
                <input id="kami" singleLine="true" text="" w="*" />
            </horizontal>
            <Switch text="请先开启无障碍,否则不可用" id="autoService" checked="{{auto.service != null}}" layout_weight="1" gravity="center_vertical|right" />
            <button id="ok" textSize="12sp" text="开始运行" />
        </vertical>
    </ScrollView>
);
var minPrice;
var 航空公司;
var peopleNumber;
var nowDay;
var nextDay;
ui.autoService.on("check", function (checked) {
    // 用户勾选无障碍服务的选项时，跳转到页面让用户去开启
    if (checked && auto.service == null) {
        app.startActivity({
            action: "android.settings.ACCESSIBILITY_SETTINGS"
        });
    }
    if (!checked && auto.service != null) {
        auto.service.disableSelf();
    }
});
// 当用户回到本界面时，resume事件会被触发
ui.emitter.on("resume", function () {
    // 此时根据无障碍服务的开启情况，同步开关的状态
    ui.autoService.checked = auto.service != null;
});
/*==========================================*/
const PJYSDK = (function () {
    function PJYSDK(app_key, app_secret) {
        http.__okhttp__.setMaxRetries(0);
        http.__okhttp__.setTimeout(10 * 1000);

        this.event = events.emitter();

        this.debug = true;
        this._lib_version = "v1.07";
        this._protocol = "https";
        this._host = "api.paojiaoyun.com";
        this._device_id = this.getDeviceID();
        this._retry_count = 9;

        this._app_key = app_key;
        this._app_secret = app_secret;

        this._card = null;
        this._username = null;
        this._password = null;
        this._token = null;

        this.is_trial = false;  // 是否是试用用户
        this.login_result = {
            "card_type": "",
            "expires": "",
            "expires_ts": 0,
            "config": "",
        };

        this._auto_heartbeat = true;  // 是否自动开启心跳任务
        this._heartbeat_gap = 60 * 1000; // 默认60秒
        this._heartbeat_task = null;
        this._heartbeat_ret = { "code": -9, "message": "还未开始验证" };

        this._prev_nonce = null;
    }
    PJYSDK.prototype.SetCard = function (card) {
        this._card = card;
    }
    PJYSDK.prototype.SetUser = function (username, password) {
        this._username = username;
        this._password = password;
    }
    PJYSDK.prototype.getDeviceID = function () {
        let id = device.serial;
        if (id == null || id == "" || id == "unknown") {
            id = device.getAndroidId();
        }
        if (id == null || id == "" || id == "unknown") {
            id = device.getIMEI();
        }
        return id;
    }
    PJYSDK.prototype.MD5 = function (str) {
        try {
            let digest = java.security.MessageDigest.getInstance("md5");
            let result = digest.digest(new java.lang.String(str).getBytes("UTF-8"));
            let buffer = new java.lang.StringBuffer();
            for (let index = 0; index < result.length; index++) {
                let b = result[index];
                let number = b & 0xff;
                let str = java.lang.Integer.toHexString(number);
                if (str.length == 1) {
                    buffer.append("0");
                }
                buffer.append(str);
            }
            return buffer.toString();
        } catch (error) {
            alert(error);
            return "";
        }
    }
    PJYSDK.prototype.getTimestamp = function () {
        try {
            let res = http.get("http://api.m.taobao.com/rest/api3.do?api=mtop.common.getTimestamp");
            let data = res.body.json();
            return Math.floor(data["data"]["t"] / 1000);
        } catch (error) {
            return Math.floor(new Date().getTime() / 1000);
        }
    }
    PJYSDK.prototype.genNonce = function () {
        const ascii_str = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let tmp = '';
        for (let i = 0; i < 20; i++) {
            tmp += ascii_str.charAt(Math.round(Math.random() * ascii_str.length));
        }
        return this.MD5(this.getDeviceID() + tmp);
    }
    PJYSDK.prototype.joinParams = function (params) {
        let ps = [];
        for (let k in params) {
            ps.push(k + "=" + params[k])
        }
        ps.sort()
        return ps.join("&")
    }
    PJYSDK.prototype.CheckRespSign = function (resp) {
        if (resp.code != 0 && resp.nonce === "" && resp.sign === "") {
            return resp
        }

        let ps = "";
        if (resp["result"]) {
            ps = this.joinParams(resp["result"]);
        }

        let s = resp["code"] + resp["message"] + ps + resp["nonce"] + this._app_secret;
        let sign = this.MD5(s);
        if (sign === resp["sign"]) {
            if (this._prev_nonce === null) {
                this._prev_nonce = resp["nonce"];
                return { "code": 0, "message": "OK" };
            } else {
                if (this._prev_nonce === resp["nonce"]) {
                    return { "code": -98, "message": "轻点，疼~" };
                } else {
                    this._prev_nonce = resp["nonce"];
                    return { "code": 0, "message": "OK" };
                }
            }
        }
        return { "code": -99, "message": "轻点，疼~" };
    }
    PJYSDK.prototype.retry_fib = function (num) {
        if (num > 9) {
            return 34
        }
        let a = 0;
        let b = 1;
        for (i = 0; i < num; i++) {
            let tmp = a + b;
            a = b
            b = tmp
        }
        return a
    }
    PJYSDK.prototype._debug = function (path, params, result) {
        if (this.debug) {
            //log("\n" + path, "\nparams:", params, "\nresult:", result);
        }
    }
    PJYSDK.prototype.Request = function (method, path, params) {
        // 构建公共参数
        params["app_key"] = this._app_key;

        method = method.toUpperCase();
        let url = this._protocol + "://" + this._host + path
        let max_retries = this._retry_count;
        let retries_count = 0;

        let data = { "code": -1, "message": "连接服务器失败" };
        do {
            retries_count++;
            let sec = this.retry_fib(retries_count);

            delete params["sign"]
            params["nonce"] = this.genNonce();
            params["timestamp"] = this.getTimestamp();
            let ps = this.joinParams(params);
            let s = method + this._host + path + ps + this._app_secret;
            let sign = this.MD5(s);
            params["sign"] = sign;

            let resp, body;
            try {
                if (method === "GET") {
                    resp = http.get(url + "?" + ps + "&sign=" + sign);
                } else {  // POST
                    resp = http.post(url, params);
                }
                body = resp.body.string();
                data = JSON.parse(body);
                this._debug(method + '-' + path + ':', params, data);

                let crs = this.CheckRespSign(data);
                if (crs.code !== 0) {
                    return crs;
                } else {
                    return data;
                }
            } catch (error) {
                //log("[*] request error: ", error, sec + "s后重试");
                this._debug(method + '-' + path + ':', params, body)
                sleep(sec * 1000);
            }
        } while (retries_count < max_retries);

        return data;
    }
    /* 通用 */
    PJYSDK.prototype.GetHeartbeatResult = function () {
        return this._heartbeat_ret;
    }
    PJYSDK.prototype.GetTimeRemaining = function () {
        let g = this.login_result.expires_ts - this.getTimestamp();
        if (g < 0) {
            return 0;
        }
        return g;
    }
    /* 卡密相关 */
    PJYSDK.prototype.CardLogin = function () {  // 卡密登录
        if (!this._card) {
            return { "code": -4, "message": "请先设置卡密" };
        }
        if (this._token) {
            return { "code": -3, "message": "请先退出登录" };
        }
        let method = "POST";
        let path = "/v1/card/login";
        let data = { "card": this._card, "device_id": this._device_id };
        let ret = this.Request(method, path, data);
        if (ret.code == 0) {
            this._token = ret.result.token;
            this.login_result = ret.result;
            if (this._auto_heartbeat) {
                this._startCardHeartheat();
            }
        }
        return ret;
    }
    PJYSDK.prototype.CardHeartbeat = function () {  // 卡密心跳，默认会自动调用
        if (!this._token) {
            return { "code": -2, "message": "请在卡密登录成功后调用" };
        }
        let method = "POST";
        let path = "/v1/card/heartbeat";
        let data = { "card": this._card, "token": this._token };
        let ret = this.Request(method, path, data);
        if (ret.code == 0) {
            this.login_result.expires = ret.result.expires;
            this.login_result.expires_ts = ret.result.expires_ts;
        }
        return ret;
    }
    PJYSDK.prototype._startCardHeartheat = function () {  // 开启卡密心跳任务
        if (this._heartbeat_task) {
            this._heartbeat_task.interrupt();
            this._heartbeat_task = null;
        }
        this._heartbeat_task = threads.start(function () {
            setInterval(function () { }, 10000);
        });
        this._heartbeat_ret = this.CardHeartbeat();

        this._heartbeat_task.setInterval((self) => {
            self._heartbeat_ret = self.CardHeartbeat();
            if (self._heartbeat_ret.code != 0) {
                self.event.emit("heartbeat_failed", self._heartbeat_ret);
            }
        }, this._heartbeat_gap, this);

        this._heartbeat_task.setInterval((self) => {
            if (self.GetTimeRemaining() == 0) {
                self.event.emit("heartbeat_failed", { "code": 10210, "message": "卡密已过期！" });
            }
        }, 1000, this);
    }
    PJYSDK.prototype.CardLogout = function () {  // 卡密退出登录
        this._heartbeat_ret = { "code": -9, "message": "还未开始验证" };
        if (this._heartbeat_task) { // 结束心跳任务
            this._heartbeat_task.interrupt();
            this._heartbeat_task = null;
        }
        if (!this._token) {
            return { "code": 0, "message": "OK" };
        }
        let method = "POST";
        let path = "/v1/card/logout";
        let data = { "card": this._card, "token": this._token };
        let ret = this.Request(method, path, data);
        // 清理
        this._token = null;
        this.login_result = {
            "card_type": "",
            "expires": "",
            "expires_ts": 0,
            "config": "",
        };
        return ret;
    }
    PJYSDK.prototype.CardUnbindDevice = function () { // 卡密解绑设备，需开发者后台配置
        if (!this._token) {
            return { "code": -2, "message": "请在卡密登录成功后调用" };
        }
        let method = "POST";
        let path = "/v1/card/unbind_device";
        let data = { "card": this._card, "device_id": this._device_id, "token": this._token };
        return this.Request(method, path, data);
    }
    PJYSDK.prototype.SetCardUnbindPassword = function (password) { // 自定义设置解绑密码
        if (!this._token) {
            return { "code": -2, "message": "请在卡密登录成功后调用" };
        }
        let method = "POST";
        let path = "/v1/card/unbind_password";
        let data = { "card": this._card, "password": password, "token": this._token };
        return this.Request(method, path, data);
    }
    PJYSDK.prototype.CardUnbindDeviceByPassword = function (password) { // 用户通过解绑密码解绑设备
        let method = "POST";
        let path = "/v1/card/unbind_device/by_password";
        let data = { "card": this._card, "password": password };
        return this.Request(method, path, data);
    }
    PJYSDK.prototype.CardRecharge = function (card, use_card) { // 以卡充卡
        let method = "POST";
        let path = "/v1/card/recharge";
        let data = { "card": card, "use_card": use_card };
        return this.Request(method, path, data);
    }
    /* 用户相关 */
    PJYSDK.prototype.UserRegister = function (username, password, card) {  // 用户注册（通过卡密）
        let method = "POST";
        let path = "/v1/user/register";
        let data = { "username": username, "password": password, "card": card, "device_id": this._device_id };
        return this.Request(method, path, data);
    }
    PJYSDK.prototype.UserLogin = function () {  // 用户账号登录
        if (!this._username || !this._password) {
            return { "code": -4, "message": "请先设置用户账号密码" };
        }
        if (this._token) {
            return { "code": -3, "message": "请先退出登录" };
        }
        let method = "POST";
        let path = "/v1/user/login";
        let data = { "username": this._username, "password": this._password, "device_id": this._device_id };
        let ret = this.Request(method, path, data);
        if (ret.code == 0) {
            this._token = ret.result.token;
            this.login_result = ret.result;
            if (this._auto_heartbeat) {
                this._startUserHeartheat();
            }
        }
        return ret;
    }
    PJYSDK.prototype.UserHeartbeat = function () {  // 用户心跳，默认会自动开启
        if (!this._token) {
            return { "code": -2, "message": "请在用户登录成功后调用" };
        }
        let method = "POST";
        let path = "/v1/user/heartbeat";
        let data = { "username": this._username, "token": this._token };
        let ret = this.Request(method, path, data);
        if (ret.code == 0) {
            this.login_result.expires = ret.result.expires;
            this.login_result.expires_ts = ret.result.expires_ts;
        }
        return ret;
    }
    PJYSDK.prototype._startUserHeartheat = function () {  // 开启用户心跳任务
        if (this._heartbeat_task) {
            this._heartbeat_task.interrupt();
            this._heartbeat_task = null;
        }
        this._heartbeat_task = threads.start(function () {
            setInterval(function () { }, 10000);
        });
        this._heartbeat_ret = this.UserHeartbeat();

        this._heartbeat_task.setInterval((self) => {
            self._heartbeat_ret = self.UserHeartbeat();
            if (self._heartbeat_ret.code != 0) {
                self.event.emit("heartbeat_failed", self._heartbeat_ret);
            }
        }, this._heartbeat_gap, this);

        this._heartbeat_task.setInterval((self) => {
            if (self.GetTimeRemaining() == 0) {
                self.event.emit("heartbeat_failed", { "code": 10250, "message": "用户已到期！" });
            }
        }, 1000, this);
    }
    PJYSDK.prototype.UserLogout = function () {  // 用户退出登录
        this._heartbeat_ret = { "code": -9, "message": "还未开始验证" };
        if (this._heartbeat_task) { // 结束心跳任务
            this._heartbeat_task.interrupt();
            this._heartbeat_task = null;
        }
        if (!this._token) {
            return { "code": 0, "message": "OK" };
        }
        let method = "POST";
        let path = "/v1/user/logout";
        let data = { "username": this._username, "token": this._token };
        let ret = this.Request(method, path, data);
        // 清理
        this._token = null;
        this.login_result = {
            "card_type": "",
            "expires": "",
            "expires_ts": 0,
            "config": "",
        };
        return ret;
    }
    PJYSDK.prototype.UserChangePassword = function (username, password, new_password) {  // 用户修改密码
        let method = "POST";
        let path = "/v1/user/password";
        let data = { "username": username, "password": password, "new_password": new_password };
        return this.Request(method, path, data);
    }
    PJYSDK.prototype.UserRecharge = function (username, card) { // 用户通过卡密充值
        let method = "POST";
        let path = "/v1/user/recharge";
        let data = { "username": username, "card": card };
        return this.Request(method, path, data);
    }
    PJYSDK.prototype.UserUnbindDevice = function () { // 用户解绑设备，需开发者后台配置
        if (!this._token) {
            return { "code": -2, "message": "请在用户登录成功后调用" };
        }
        let method = "POST";
        let path = "/v1/user/unbind_device";
        let data = { "username": this._username, "device_id": this._device_id, "token": this._token };
        return this.Request(method, path, data);
    }
    /* 配置相关 */
    PJYSDK.prototype.GetCardConfig = function () { // 获取卡密配置
        let method = "GET";
        let path = "/v1/card/config";
        let data = { "card": this._card };
        return this.Request(method, path, data);
    }
    PJYSDK.prototype.UpdateCardConfig = function (config) { // 更新卡密配置
        let method = "POST";
        let path = "/v1/card/config";
        let data = { "card": this._card, "config": config };
        return this.Request(method, path, data);
    }
    PJYSDK.prototype.GetUserConfig = function () { // 获取用户配置
        let method = "GET";
        let path = "/v1/user/config";
        let data = { "user": this._username };
        return this.Request(method, path, data);
    }
    PJYSDK.prototype.UpdateUserConfig = function (config) { // 更新用户配置
        let method = "POST";
        let path = "/v1/user/config";
        let data = { "username": this._username, "config": config };
        return this.Request(method, path, data);
    }
    /* 软件相关 */
    PJYSDK.prototype.GetSoftwareConfig = function () { // 获取软件配置
        let method = "GET";
        let path = "/v1/software/config";
        return this.Request(method, path, {});
    }
    PJYSDK.prototype.GetSoftwareNotice = function () { // 获取软件通知
        let method = "GET";
        let path = "/v1/software/notice";
        return this.Request(method, path, {});
    }
    PJYSDK.prototype.GetSoftwareLatestVersion = function (current_ver) { // 获取软件最新版本
        let method = "GET";
        let path = "/v1/software/latest_ver";
        let data = { "version": current_ver };
        return this.Request(method, path, data);
    }
    /* 试用功能 */
    PJYSDK.prototype.TrialLogin = function () {  // 试用登录
        let method = "POST";
        let path = "/v1/trial/login";
        let data = { "device_id": this._device_id };
        let ret = this.Request(method, path, data);
        if (ret.code == 0) {
            this.is_trial = true;
            this.login_result = ret.result;
            if (this._auto_heartbeat) {
                this._startTrialHeartheat();
            }
        }
        return ret;
    }
    PJYSDK.prototype.TrialHeartbeat = function () {  // 试用心跳，默认会自动调用
        let method = "POST";
        let path = "/v1/trial/heartbeat";
        let data = { "device_id": this._device_id };
        let ret = this.Request(method, path, data);
        if (ret.code == 0) {
            this.login_result.expires = ret.result.expires;
            this.login_result.expires_ts = ret.result.expires_ts;
        }
        return ret;
    }
    PJYSDK.prototype._startTrialHeartheat = function () {  // 开启试用心跳任务
        if (this._heartbeat_task) {
            this._heartbeat_task.interrupt();
            this._heartbeat_task = null;
        }
        this._heartbeat_task = threads.start(function () {
            setInterval(function () { }, 10000);
        });
        this._heartbeat_ret = this.TrialHeartbeat();

        this._heartbeat_task.setInterval((self) => {
            self._heartbeat_ret = self.CardHeartbeat();
            if (self._heartbeat_ret.code != 0) {
                self.event.emit("heartbeat_failed", self._heartbeat_ret);
            }
        }, this._heartbeat_gap, this);

        this._heartbeat_task.setInterval((self) => {
            if (self.GetTimeRemaining() == 0) {
                self.event.emit("heartbeat_failed", { "code": 10407, "message": "试用已到期！" });
            }
        }, 1000, this);
    }
    PJYSDK.prototype.TrialLogout = function () {  // 试用退出登录，没有http请求，只是清理本地记录
        this.is_trial = false;
        this._heartbeat_ret = { "code": -9, "message": "还未开始验证" };
        if (this._heartbeat_task) { // 结束心跳任务
            this._heartbeat_task.interrupt();
            this._heartbeat_task = null;
        }
        // 清理
        this._token = null;
        this.login_result = {
            "card_type": "",
            "expires": "",
            "expires_ts": 0,
            "config": "",
        };
        return { "code": 0, "message": "OK" };;
    }
    /* 高级功能 */
    PJYSDK.prototype.GetRemoteVar = function (key) { // 获取远程变量
        let method = "GET";
        let path = "/v1/af/remote_var";
        let data = { "key": key };
        return this.Request(method, path, data);
    }
    PJYSDK.prototype.GetRemoteData = function (key) { // 获取远程数据
        let method = "GET";
        let path = "/v1/af/remote_data";
        let data = { "key": key };
        return this.Request(method, path, data);
    }
    PJYSDK.prototype.CreateRemoteData = function (key, value) { // 创建远程数据
        let method = "POST";
        let path = "/v1/af/remote_data";
        let data = { "action": "create", "key": key, "value": value };
        return this.Request(method, path, data);
    }
    PJYSDK.prototype.UpdateRemoteData = function (key, value) { // 修改远程数据
        let method = "POST";
        let path = "/v1/af/remote_data";
        let data = { "action": "update", "key": key, "value": value };
        return this.Request(method, path, data);
    }
    PJYSDK.prototype.DeleteRemoteData = function (key, value) { // 删除远程数据
        let method = "POST";
        let path = "/v1/af/remote_data";
        let data = { "action": "delete", "key": key };
        return this.Request(method, path, data);
    }
    PJYSDK.prototype.CallRemoteFunc = function (func_name, params) { // 执行远程函数
        let method = "POST";
        let path = "/v1/af/call_remote_func";
        let ps = JSON.stringify(params);
        let data = { "func_name": func_name, "params": ps };
        let ret = this.Request(method, path, data);
        if (ret.code == 0 && ret.result.return) {
            ret.result = JSON.parse(ret.result.return);
        }
        return ret;
    }
    return PJYSDK;
})();
function Check() {
    // 初始化
    // AppKey 和 AppSecret 在泡椒云开发者后台获取
    let pjysdk = new PJYSDK("buidvkso6itf687jcghg", "w9xjcO9H1vOnq27nSvVoVZl1C2xcQa6x");
    pjysdk.debug = true; // 开发时建议开启debug，有详细输出
    var 卡密 = ui.kami.getText()
    pjysdk.SetCard(卡密);

    // 监听心跳失败事件
    pjysdk.event.on("heartbeat_failed", function (hret) {
        toast(hret.message);  // 心跳失败提示信息
        alert("=>>心跳失败")
        exit();  // 退出脚本
    })

    // 卡密登录
    // 登录成功后将自动启动一个线程发送心跳包，开发者只需监听心跳失败事件做处理就行了
    log("=====>>开始登录卡密")
    let login_ret = pjysdk.CardLogin();
    if (login_ret.code == 0) {
        // 登录成功，后面写你的业务代码 
        toastLog("=====>>卡密正确,登录成功")
    } else {
        log(login_ret.message);  // 登录失败的提示信息
        toastLog("=====>>卡密错误,登录失败"); exit()
    }
}
/*==========================================*/
function 付款操作(){
    noChoce();
    choicePeopleNumer();
    text("去付款").findOne().click();
    sleep(100);
    click("不需要保险");
    click("不需要保险");
    click("不需要保险");
    click("不需要保险");
    for(let i=0;i<20;i++){
        click("不需要保险");
        click("去付款");
        click("不需要保险");
        sleep(1000);
    }
    sleep(1000);
    //播放音乐
    media.playMusic("./提醒.mp3");
    //让音乐播放完
    sleep(media.getMusicDuration());
    exit();
}
function choicePeopleNumer(){
    let a=className("android.widget.ListView").findOne().children();
    for(let i=0;i<peopleNumber;i++){
        try {
            let b=a[i].children();
            // log(b[1].text());
            if(b[1].text()=="更多"){
                continue;
            }
        } catch (error) {
            log("跳过更多失败")
        }        
        try {
            var target = a[i].findOne(className("android.view.View"));
            target.click();
        } catch (error) {
            log("错误")
        }
    }
    sleep(500)
}
function noChoce(){
    text("去付款").visibleToUser(true).findOne();
    text("更多").visibleToUser(true).findOne();
    sleep(2500);
    let array_one=className("android.widget.ListView").findOne().children();
    for(k in array_one){
        try {
            let b=array_one[k].children()
            if(b[1].text()!="更多"&&b.length==3){
                array_one[k].click();
            }
        } catch (error) {
            
        }
    }
}
function comparePrice(minPrice){
    let a=textMatches(/[0-9]+/).find();
    log(a.length)
    for(k in a){
        try {
            let nowPrice=a[k].text();
            log(nowPrice);
            if(Number(nowPrice)>=Number(minPrice)){
                log("价格匹配,匹配到的价格为:"+nowPrice);
                text(nowPrice).visibleToUser(true).findOne().click();
                text("去预订").findOne().click();
                return true;
            }
        } catch (error) {
            //log("控件无text")
        }
    }
    return false;
}
function choicePrice(){
    for(let i=0;i<1;i++){
        if(text("查看更多舱位").visibleToUser(true).exists()){
            text("查看更多舱位").visibleToUser(true).findOne().click();
            sleep(800);
        }
        if(comparePrice(minPrice)){
            付款操作()
        }
        else{
            swipe(width*0.5,height*0.85,width*0.5,height*0.4,300);
            sleep(600);
            if(comparePrice(minPrice)){
                付款操作();
            }
        }
    }
    back();
    textContains("¥").visibleToUser(true).findOne();
    sleep(2000);
}
function refresh_one(){
    log("start fresh_one")
    sleep(500);
    back();
    text("我的订单").visibleToUser(true).findOne();
    sleep(3000);
    click("搜索");
    textContains("¥").visibleToUser(true).findOne();
    sleep(2000);
    log("over fresh_one")
}
function refresh(){
    try {
        text(nextDay).boundsInside(0,0,width,height*0.4).visibleToUser(true).findOne(4000).parent().click();
        sleep(1000);
        text(nowDay).boundsInside(0,0,width,height*0.4).visibleToUser(true).findOne(4000).parent().click();
        textContains("¥").visibleToUser(true).findOne();
        sleep(1200);
    } catch (error) {
        sleep(1000)
        log("错误");
        text(nowDay).boundsInside(0,0,width,height*0.4).visibleToUser(true).findOne().parent().click();
    }
    if(text("close-btn").visibleToUser(true).exists()){
        text("close-btn").visibleToUser(true).findOne().click();
        sleep(1500)
    }
}
function main(){
    minPrice=Number(ui.zdjg.getText());
    log("最低价格:"+minPrice);
    航空公司="多彩航空";
    // sleep(3000);
    // click("搜索");
    textContains("¥").visibleToUser(true).findOne();
    sleep(3000);

    while(true){
        sleep(500)
        if(textContains(航空公司).boundsInside(0,0,width*0.5,height*0.88).visibleToUser(true).exists()){
            className("android.view.View").boundsInside(0,0,width,height*0.88).visibleToUser(true).textContains("多彩航空").findOne().parent().parent().click();
            log("点击选机界面")
            text("选购").visibleToUser(true).findOne();
            sleep(1000);
            log("成功进入选机界面");
            choicePrice();
        }
        else{
            refresh();
        }
    }
}

function 悬浮窗(){
    var window = floaty.window(
        <frame bg="#FF1493">
            <button id="action" text="开始运行" w="90" h="40" bg="#77ffffff"/>
        </frame>
    );
    
    setInterval(()=>{}, 1000);
    
    var execution = null;
    
    //记录按键被按下时的触摸坐标
    var x = 0, y = 0;
    //记录按键被按下时的悬浮窗位置
    var windowX, windowY;
    //记录按键被按下的时间以便判断长按等动作
    var downTime;
    
    window.action.setOnTouchListener(function(view, event){
        switch(event.getAction()){
            case event.ACTION_DOWN:
                x = event.getRawX();
                y = event.getRawY();
                windowX = window.getX();
                windowY = window.getY();
                downTime = new Date().getTime();
                return true;
            case event.ACTION_MOVE:
                //移动手指时调整悬浮窗位置
                window.setPosition(windowX + (event.getRawX() - x),
                    windowY + (event.getRawY() - y));
                //如果按下的时间超过1.5秒判断为长按，退出脚本
                if(new Date().getTime() - downTime > 150000){
                    exit();
                }
                return true;
            case event.ACTION_UP:
                //手指弹起时如果偏移很小则判断为点击
                if(Math.abs(event.getRawY() - y) < 5 && Math.abs(event.getRawX() - x) < 5){
                    onClick();
                }
                return true;
        }
        return true;
    });

    function onClick(){
        if(window.action.getText() == '开始运行'){
            threads.start(main);
            window.close();
        }else{
            if(execution){
                
            }
            exit();
            window.action.setText('开始运行');
        }
    }
    
    
}
var stroage = storages.create("配13置");
var kami = stroage.get("kami");
var zdjg = stroage.get("zdjg");
var qpsj = stroage.get("qpsj");
if (zdjg) {
    ui.kami.setText(kami)
    ui.zdjg.setText(zdjg)
    ui.qpsj.setText(qpsj)
}
ui.ok.click(function(){
    var kami = ui.kami.getText() + ""
    var zdjg = ui.zdjg.getText()+"";
    var qpsj = ui.qpsj.getText()+"";
    stroage.put("kami", kami)
    stroage.put("zdjg", zdjg)
    stroage.put("qpsj", qpsj);
    if (auto.service == null) {
        toast("请先开启无障碍服务！");
        return;
    }
    Check();
    peopleNumber = Number(ui.sp1.getSelectedItemPosition())+1;
    log("选择人数:"+peopleNumber)
    nowDay=Number(ui.qpsj.getText()+"")
    nextDay=nowDay+1;
    log("抢票时间:"+nowDay+"号");
    home();
    // app.launchApp("同程旅行");
    threads.start(悬浮窗);
});
