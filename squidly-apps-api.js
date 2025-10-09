FIREBASE_ON_VALUE_CALLBACKS = {};
SET_ICON_CALLBACKS = {};

function firebaseSet(path, value){
    window.parent.postMessage({
        mode: "firebaseSet",
        path: path,
        value: value
    }, "*");
}

function firebaseOnValue(path){
    FIREBASE_ON_VALUE_CALLBACKS[path] = callback;
    window.parent.postMessage({
        mode: "firebaseOnValue",
        path: path,
    }, "*");
}

function setIcon(x, y, options, callback){
    let key = "setIcon_" + Math.random().toString(36).substring(2, 15);
    SET_ICON_CALLBACKS[key] = callback;
    window.parent.postMessage({
        mode: "setIcon",
        key: key,
        x: x,
        y: y,
        options: options,
    }, "*");
}

RESPONSE_FUNCTIONS = {
    firebaseOnValueCallback(data){
        if (data.path in FIREBASE_ON_VALUE_CALLBACKS){
            FIREBASE_ON_VALUE_CALLBACKS[data.path](data.value);
        }
    },
    onIconClickCallback(data){
        if (data.key in SET_ICON_CALLBACKS){
            SET_ICON_CALLBACKS[data.key](data.value);
        }
    }

}

window.addEventListener("message", (event) => {
    if (event.data.mode in RESPONSE_FUNCTIONS){
        RESPONSE_FUNCTIONS[event.data.mode](event.data);
    }
});
