// Currently, UI3's service worker does not do anything meaningful, but in the future it may extended to handle Web Push notifications or other background tasks.

self.addEventListener('install', function (event)
{
	console.log('UI3 Service Worker installing...');
	self.skipWaiting();
});

self.addEventListener('activate', function (event)
{
	console.log('UI3 Service Worker activating...');
});

self.addEventListener('fetch', function (event)
{
	// Stub necessary for browser to suggest installing PWA.
});


