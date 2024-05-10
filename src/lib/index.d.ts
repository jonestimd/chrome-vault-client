declare namespace chrome.runtime {
    interface Port {
        // Firefox only
        error?: Error;
    }
}
