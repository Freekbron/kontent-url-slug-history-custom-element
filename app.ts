import { createDeliveryClient, DeliveryClient } from "@kontent-ai/delivery-sdk";
import { IContext } from "./customElementModels/IContext";
import { ICustomElement } from "./customElementModels/ICustomElement";
import { IElement } from "./customElementModels/IElement";

const customElement = window['CustomElement'] as ICustomElement
let urlSlugElementCodename: string | null = null
let contentItemCodename: string | null = null
let currentPublishedUrlSlug: string | null = null
let pagePublished: boolean | null = null
let initialized: boolean = false
let deliveryClient: DeliveryClient | null = null
let projectId: string | null = null
let history: string[] = []
let disabled: boolean = false
const label = document.querySelector("#slug-container")

const initCustomElement = (element: IElement, context: IContext) => {
    if (!element.config || !context){
        throw new Error('Element and context must be defined.')
    }

    urlSlugElementCodename = element.config['urlSlugElementCodename']
    if (!urlSlugElementCodename){
        throw new Error('The "urlSlugElementCodename" must be defined in custom element config.')
    }
    projectId = context.projectId
    contentItemCodename = context.item.codename
    disabled = element.disabled

    history = element.value ? JSON.parse(element.value) : []
    deliveryClient = createDeliveryClient({
        environmentId: projectId,
        globalHeaders: () => [
            {
                header: 'X-KC-Wait-For-Loading-New-Content',
                value: 'true'
            }
        ]
    })
    try {
        if (!disabled){
            deliveryClient
                .item(contentItemCodename)
                .elementsParameter([urlSlugElementCodename])
                .toPromise()
                .then(res => {
                    if (res.response.status == 200){
                        currentPublishedUrlSlug = res.data.item.elements[urlSlugElementCodename as string].value
                        pagePublished = true
                    }})
                .catch(err => {
                    currentPublishedUrlSlug = null
                    pagePublished = false
                })
                .finally(() => {
                    initialized = true
                    displayHistory()
                })
        } else {
            initialized = true
            document.querySelector('.manual-input')?.remove()
            displayHistory()
        }
    } catch (error) {
    }
    
    customElement.observeElementChanges([urlSlugElementCodename], elementChanged)
}

const elementChanged = (changedElementCodenames: string[]) => {
    if (changedElementCodenames.includes(urlSlugElementCodename as string)) {
        customElement.getElementValue(urlSlugElementCodename as string, processNewUrlSlug)
    }
}

const processNewUrlSlug = (value: object) => {
    const editedUrlSlug = value.toString()
    if (editedUrlSlug !== currentPublishedUrlSlug
        && currentPublishedUrlSlug
        && !history.includes(currentPublishedUrlSlug)) {
        history.push(currentPublishedUrlSlug)
    } else if (editedUrlSlug === currentPublishedUrlSlug) {
        history = history.filter(historyItem => historyItem !== currentPublishedUrlSlug)
    }

    saveHistory()
    displayHistory()
}

const saveHistory = () => {
    history = Array.from(new Set(history))
    customElement.setValue(JSON.stringify(history))
}

const removeSlugFromHistory = (urlSlug: string) => {
    if (confirm("Are you sure you want to remove this URL slug from history?")) {
        history = history.filter(historyItem => historyItem !== urlSlug)
        saveHistory()
        displayHistory()
    }
}

const addSlugToHistory = (urlSlug: string) => {
    history.push(urlSlug)
    saveHistory()
    displayHistory()
}

document.getElementById('manual-input-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const urlSlug = (document.querySelector("input[name=newUrlSlug]") as HTMLInputElement).value
    if (!urlSlug){
        alert("The URL slug cannot be empty")
        return
    }
    addSlugToHistory(urlSlug)
});

const displayHistory = () => {
    if (!label) {
        return;
    }
    if (!initialized) {
        label.innerHTML = '(loading...)'
        return
    }

    if (Array.isArray(history) && history.length > 0 && label){
        label.innerHTML = `<div class="list">
            ${history.map(historySlugItem => {
                if (disabled || historySlugItem !== currentPublishedUrlSlug){
                    return `<div>
                        ${!disabled ? `<div>
                            <button type="button" class='btn btn--secondary btn--s' data-slug='${historySlugItem}'>
                                <span>remove</span>
                            </button>
                        </div>` : ''}
                        <span>${historySlugItem}</span>
                    </div>`
                } else {
                    return `<div>
                        <div>(pending publish)</div>
                        <span>${historySlugItem}</span>
                    </div>`
                }
            } ).join('')}
        </div>`
    } else if (pagePublished || disabled) {
        label.innerHTML = '(the URL slug has never been changed)'
    } else  {
        label.innerHTML = '(the item has never been published)'
    }

    if (!disabled){
        label.querySelectorAll('button')
            .forEach(btn =>
                btn.addEventListener(
                    'click',
                    (e) => {
                        const slug = (e.currentTarget as HTMLButtonElement).getAttribute('data-slug')
                        if (slug) {
                            removeSlugFromHistory(slug)
                        }
                    }))
    }
}

// Self-invocation
customElement.init(initCustomElement)
customElement.setHeight(185)
