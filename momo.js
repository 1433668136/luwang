const CONFIG = {
    "path": "我的坚果云/666项目/",       //脚本文件路径
    "scriptName":"666.js",          //脚本名称
    "user": "1433668136@qq.com",    //用户名
    "key": "a56dxk2va7b67pyf"      //应用秘钥
}
threads.start(function(){while(true){toastLog("请稍等...脚本加载中...");sleep(4000);}});
try {
    http.__okhttp__.setTimeout(20000);
    _res = http.get('http://dav.jianguoyun.com/dav/'+CONFIG.path+CONFIG.scriptName, {
        headers: {
            "Authorization": "Basic " + java.lang.String(android.util.Base64.encode(java.lang.String(CONFIG.user +':'  + CONFIG.key).getBytes(), 2)),
            "Content-Type": "text/plain;charset=UTF-8",
            }
        }
    ).body.string();
    threads.shutDownAll();
    engines.execScript(CONFIG.scriptName, _res);
} catch (error) {
    alert("加载超时,请重启脚本~~~");
}
