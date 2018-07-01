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

import idb from 'idb';
/*
 * Function to Open indexedDB db regardless browser support for service Worker.
 */
function openDatabase() {
    if (!navigator.serviceWorker) {
        return Promise.resolve();
    }
    //lets have a db
    return idb.open('currencies-db', 1, (upgradeDb) => {
        switch (upgradeDb.oldVersion) {
            case 0:
                upgradeDb.createObjectStore('currencies');
                upgradeDb.createObjectStore('currency-rates');
        }
    });
}


/*
 * Webservice Client for freecurrencyconverterapi.com
 * @type {class}
 */
export class Rates {
    constructor(endPoint) {
        this._endPoint = endPoint;
        this._exchangeRates = new Map();
        this._dbPromise = openDatabase();
    }

    /**
     * Return the current exchange rate give from and to currencies
     *
     * @param {String} to
     * @param {String} from
     *
     * @return {Promise}
     */
    getRate(from, to) {
        
        const key = `${from}_${to}`;
        //Try to get rate locally        
        if (this._exchangeRates.has(key)) {
            console.log('yeih! Got it locally');
            return Promise.resolve(this._exchangeRates.get(key));
        }

        // Didn't get locally? get exchange rate from the internet given endpoint.
        return fetch(`${this._endPoint}/convert?q=${key}`).then(response => {
            return response.json();
        }).then(data => {
            this._exchangeRates.set(key, data.results[key]);
            return data.results[key];
        });
    }

    /*
     * Add currency to indexedDB for offline usage.
     * 
     * @param {Array} currencies
     * @return {promise}
     */
    saveIndexedDBCurrencies(currencies) {
        return this._dbPromise.then(db => {
            const transaction = db.transaction('currencies', 'readwrite');
            const storeObject = transaction.objectStore('currencies');
            storeObject.put(currencies, 'currencies');
        });
    }

    /*
     * Promise to return all currencies live from api endpoint
     * @return {Promise State}
     */
    getLiveApiCurrencies() {
        return fetch(`${this._endPoint}/currencies`).then(response => {
            return response.json();
        });
    }


    /*
     * Promise to return currencies locally from indexedDB.
     *
     * @param {Array}
     * @return {promise}
     */
    getIndexedDBCurrencies() {
        return this._dbPromise.then(db => {
            const transactionObject = db.transaction('currencies');
            const storeObject = transactionObject.objectStore('currencies');
            return storeObject.get('currencies');
        });
    }

    /*
     * Add exchange rate to indexedDB for offline usage.
     *
     * @param {Object} exchangeRate
     * @return {promise}
     */

    saveRateIndexedDb(exchangeRate) {
        return this._dbPromise.then(db => {
            const transactionObject = db.transaction('currency-rates', 'readwrite');
            const storeObject = transactionObject.objectStore('currency-rates');
            storeObject.put(exchangeRate, exchangeRate.id);
        });
    }
    
    /*
     * Promise to return currency rate by the given key.
     *
     * @param {String} key
     *
     * @return {Promise<Object>}
     */
    getLocalDbRate(key) {
        return this._dbPromise.then(db => {
            const transactionStore = db.transaction('currency-rates');
            const storeObject = transactionStore.objectStore('currency-rates');
            return storeObject.get(key);
        });
    }
}
