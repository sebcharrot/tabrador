// background.js
// Listens for messages with URLs, and asks the browser to open.

browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.debug("event received");
    var url = request.urls[0];

    for (var i = 0; i < request.urls.length; i++) {
        var url = request.urls[i];

        if (url || url !== "") {
            browser.tabs.create({
                active: false,
                "url": url
            });
        }
    }
});