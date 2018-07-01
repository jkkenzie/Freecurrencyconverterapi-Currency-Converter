/**
 * Copyright 2018 jkkenzie@gmail.com Joseph K. Mutai. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const APP_CACHE = 'currency-converter-static-v10';
const allCaches = [ APP_CACHE ];

// Cached files
self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(APP_CACHE).then(function (cache) {
    return cache.addAll(['./', 'favicon.ico', 'js/index.js', 'css/app.css', 'https://free.currencyconverterapi.com/api/v5/currencies']);
  }));
});
// Delete old caches.
self.addEventListener('activate', event => {
    event.waitUntil(
            caches.keys().then(cacheNames => Promise.all(
                cacheNames.filter(cacheName => cacheName.startsWith('currency-converter-') && !allCaches.includes(cacheName)).map(cacheName => caches.delete(cacheName))
                ))
            );
});

// Fetch data from cache.
self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);

    if (requestUrl.origin === location.origin) {
        if (requestUrl.pathname === './') {
            event.respondWith(caches.match('./'));
            return;
        }
    }
    event.respondWith(
            caches.match(event.request).then(response => response || fetch(event.request))
            );
});
//SkipWaiting
self.addEventListener('message', event => {
    if (event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
});
