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
import { Rates } from './rates';
const apiUrl = 'https://free.currencyconverterapi.com/api/v5';//latest version
const rates = new Rates(apiUrl);

let ready = false; //prevent onreadystatechange being run twice
document.onreadystatechange = () => {

    if (ready) {
        return;
    }
    // interactive = DOMContentLoaded & complete = window.load
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        ready = true;

        registerServiceWorker(); //Register Service Worker
        
        // Global constants
        const fromCurrency = getDomElement('.Select-from');
        const selectTo = getDomElement('.Select-to');
        const inputFrom = getDomElement('.Control-from');
        const inputTo = getDomElement('.Control-to');
        const switchCoversion = document.querySelectorAll('.btn-SwitchCurrencies');

        // Listen for events
        switchCoversion.forEach(button => {
            button.addEventListener('click', (event) => {
                const newFromValue = selectTo.value;
                const newToValue = fromCurrency.value;

                button.blur();

                fromCurrency.value = newFromValue;
                selectTo.value = newToValue;
                getExchangeValue(fromCurrency.value, selectTo.value, inputFrom.value).then(result => {
                    inputTo.value = result;
                });
            });
        });
        inputFrom.addEventListener('input', () => {
            getExchangeValue(fromCurrency.value, selectTo.value, inputFrom.value).then(result => {
                inputTo.value = result;
            });
        });
        fromCurrency.addEventListener('change', () => {
            getExchangeValue(fromCurrency.value, selectTo.value, inputFrom.value).then(result => {
                inputTo.value = result;
            });
        });
        inputTo.addEventListener('input', () => {
            getExchangeValue(selectTo.value, fromCurrency.value, inputTo.value).then(result => {
                inputFrom.value = result;
            });
        });
        selectTo.addEventListener('change', () => {
            getExchangeValue(fromCurrency.value, selectTo.value, inputFrom.value).then(result => {
                inputTo.value = result;
            });
        });



        //Get currencies online and offline if need be
        rates.getLiveApiCurrencies().then(data => {
            const currencies = Object.values(data.results).sort((a, b) => {
                if (a.currencyName < b.currencyName)
                    return -1;
                if (a.currencyName > b.currencyName)
                    return 1;

                return 0;
            });
            
            //Fill Options
            fillCurrencyOptions(currencies);
            // Offline backup on IndexedDB for offline users
            rates.saveIndexedDBCurrencies(currencies);
            // Get the Exchange value
            getExchangeValue(fromCurrency.value, selectTo.value, inputFrom.value).then(result => {
                inputTo.value = result;
            });
        }).catch(error => {
            // Try to get currencies from the IndexedDB
            rates.getIndexedDBCurrencies().then(data => {
                if (data === undefined)
                    return;

                // Populate selects options
                fillCurrencyOptions(data);

                // Perform initial conversion
                getExchangeValue(fromCurrency.value, selectTo.value, inputFrom.value).then(result => {
                    inputTo.value = result;
                });
            });
        });
    }
};


/**
 * Provide Curreny options list for inputs.
 *
 * @param {Array} currencies
 */
function fillCurrencyOptions(currencies) {
    const options = document.querySelectorAll('.form-Select');
    let OptionSelected = false;
    options.forEach((select, index) => {
        for (let currency of currencies) {
            //People Like Dollars,..so flowing with it
            if ((index === 0 && currency.id === 'USD') || (index === 1 && currency.id === 'KES')) {
                OptionSelected = true;
            } else {
                OptionSelected = false;
            }

            select.options[select.options.length] = new Option(currency.currencyName, currency.id, false, OptionSelected);
        }
    });
}


/**
 * Return value of an amount being converted
 *
 * @param {Number} fromCurrency
 * @param {Number} toCurrency
 * @param {Number} amount
 *
 * @return {Promise}
 */
function getExchangeValue(fromCurrency, toCurrency, amount) {
    return rates.getRate(fromCurrency, toCurrency).then(exchangeRate => {
        // Save the exchange rate offline use
        rates.saveRateIndexedDb(exchangeRate);

        return amount * exchangeRate.val;
    }).catch(error => {
        // Use local DB instead
        return rates.getLocalDbRate(`${fromCurrency}_${toCurrency}`).then(data => {
            if (data === undefined)
                return;

            return amount * data.val;
        });
    });
}

/**************************************** 
 * ****** SERVICE WORKER METHODS ******** 
 ***************************************/
/**
 * Register the service worker.
 */
function registerServiceWorker() {
   
    if (!navigator.serviceWorker) return;
 
    let reloading;
    navigator.serviceWorker.register('/sw.js').then(function (reg) {
    
        if (!navigator.serviceWorker.controller) { return;   }

        if (reg.installing) {
            trackInstalling(reg.installing);
            return;
        }
        if (reg.waiting) {
            updateReady(reg.waiting);
            return;
        }
        reg.addEventListener('updatefound', () => {
            trackInstalling(reg.installing);
        });
    });
    
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        window.location.reload();
        reloading = true;
    });
}

/*
 * Track Service Worker states.
 */
function trackInstalling(worker) {
    worker.addEventListener('statechange', () => {
        if (worker.state === 'installed') {
            updateReady(worker);
        }
    });
}
/*
 * Service Worker Update ready function
 */
function updateReady(worker) {
    let toastWrapper = getDomElement('.tst-ToastWrapper');

    toastWrapper.classList.remove('tst-ToastWrapper-hidden');
    toastWrapper.querySelector('.tst-Toast_Button-refresh').addEventListener('click', () => {
        worker.postMessage({action: 'skipWaiting'});
    });
    toastWrapper.querySelector('.tst-Toast_Button-dismiss').addEventListener('click', () => {
        toastWrapper.classList.add('tst-ToastWrapper-hidden');
    });
}





/************************** * 
 * ****** Utilities ******** 
 **************************/

/*
 * Utility : returns html element matching the selector otherwise return _
 *
 * @param {String} selector
 * @return {HTMLElement}
 */
function getDomElement(selector) {
    return document.querySelector(selector) || document.createElement('_');
}

