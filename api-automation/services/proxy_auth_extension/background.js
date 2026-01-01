
            var config = {
                mode: "fixed_servers",
                rules: {
                    singleProxy: { scheme: "http", host: "203.174.22.232", port: parseInt(3128) },
                    bypassList: []
                }
            };
            chrome.proxy.settings.set({value: config, scope: "regular"}, function() {});
            chrome.webRequest.onAuthRequired.addListener(
                function(details) {
                    return { authCredentials: { username: "proxy", password: "tatkal@1234" } };
                },
                {urls: ["<all_urls>"]},
                ["blocking"]
            );
        