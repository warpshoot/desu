(function () {
    const root = '/desu/';
    const links = [
        { rel: 'icon', type: 'image/x-icon', href: root + 'favicon.ico' },
        { rel: 'apple-touch-icon', href: root + 'apple-touch-icon.png' }
    ];

    links.forEach(data => {
        const link = document.createElement('link');
        Object.keys(data).forEach(key => link.setAttribute(key, data[key]));
        document.head.appendChild(link);
    });
})();
