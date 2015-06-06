'use strict';
let Rx = require('rx');
const ALL_PROPS = '*';
const PROPS_DRIVER_NAME = 'props';
const EVENTS_SINK_NAME = 'events';

function makeDispatchFunction(element, eventName) {
  return function dispatchCustomEvent(evData) {
    //console.log('%cdispatchCustomEvent ' + eventName,
    //  'background-color: #CCCCFF; color: black');
    var event;
    try {
      event = new Event(eventName);
    } catch (err) {
      event = document.createEvent('Event');
      event.initEvent(eventName, true, true);
    }
    event.detail = evData;
    element.dispatchEvent(event);
  };
}

function subscribeDispatchers(element) {
  let {customEvents} = element.cycleCustomElementMetadata;
  let disposables = new Rx.CompositeDisposable();
  for (let name in customEvents) { if (customEvents.hasOwnProperty(name)) {
    if (typeof customEvents[name].subscribe === 'function') {
      let disposable = customEvents[name].subscribe(
        makeDispatchFunction(element, name)
      );
      disposables.add(disposable);
    }
  }}
  return disposables;
}

function subscribeDispatchersWhenRootChanges(metadata) {
  return metadata.rootElem$
    .distinctUntilChanged(Rx.helpers.identity,
      (x, y) => (x && y && x.isEqualNode && x.isEqualNode(y))
    )
    .subscribe(function resubscribeDispatchers(rootElem) {
      if (metadata.eventDispatchingSubscription) {
        metadata.eventDispatchingSubscription.dispose();
      }
      metadata.eventDispatchingSubscription = subscribeDispatchers(rootElem);
    });
}

function subscribeEventDispatchingSink(element, widget) {
  element.cycleCustomElementMetadata.eventDispatchingSubscription =
    subscribeDispatchers(element);
  widget.disposables.add(
    element.cycleCustomElementMetadata.eventDispatchingSubscription
  );
  widget.disposables.add(
    subscribeDispatchersWhenRootChanges(element.cycleCustomElementMetadata)
  );
}

function makePropertiesDriver() {
  let propertiesDriver = {};
  let defaultComparer = Rx.helpers.defaultComparer;
  Object.defineProperty(propertiesDriver, 'type', {
    enumerable: false,
    value: 'PropertiesDriver'
  });
  Object.defineProperty(propertiesDriver, 'get', {
    enumerable: false,
    value: function get(streamKey = ALL_PROPS, comparer = defaultComparer) {
      if (typeof this[streamKey] === 'undefined') {
        this[streamKey] = new Rx.ReplaySubject(1);
      }
      return this[streamKey]
        .distinctUntilChanged(Rx.helpers.identity, comparer);
    }
  });
  return propertiesDriver;
}

function createContainerElement(tagName, vtreeProperties) {
  let element = document.createElement('div');
  element.id = vtreeProperties.id || '';
  element.className = vtreeProperties.className || '';
  element.className += ' cycleCustomElement-' + tagName.toUpperCase();
  return element;
}

function warnIfVTreeHasNoKey(vtree) {
  if (typeof vtree.key === 'undefined') {
    console.warn('Missing `key` property for Cycle custom element ' +
      vtree.tagName);
  }
}

function throwIfVTreeHasPropertyChildren(vtree) {
  if (typeof vtree.properties.children !== 'undefined') {
    throw new Error('Custom element should not have property `children`. ' +
      'It is reserved for children elements nested into this custom element.');
  }
}

function makeCustomElementInput(domOutput, propertiesDriver, domDriverName) {
  return {
    get(driverName, ...params) {
      if (driverName === domDriverName) {
        return domOutput.get.apply(null, params);
      } else if (driverName === PROPS_DRIVER_NAME) {
        return propertiesDriver.get.apply(propertiesDriver, params);
      } else {
        throw new Error(`No such internal driver named '${driverName}' for ` +
          `custom elements. Use '${domDriverName}' or ` +
          `'${PROPS_DRIVER_NAME}' instead.`);
      }
    }
  };
}

function makeConstructor() {
  return function customElementConstructor(vtree, CERegistry, driverName) {
    //console.log('%cnew (constructor) custom element ' + vtree.tagName,
    //  'color: #880088');
    warnIfVTreeHasNoKey(vtree);
    throwIfVTreeHasPropertyChildren(vtree);
    this.type = 'Widget';
    this.properties = vtree.properties;
    this.properties.children = vtree.children;
    this.key = vtree.key;
    this.isCustomElementWidget = true;
    this.customElementsRegistry = CERegistry;
    this.driverName = driverName;
    this.firstRootElem$ = new Rx.ReplaySubject(1);
    this.disposables = new Rx.CompositeDisposable();
  };
}

function validateDefFnOutput(defFnOutput, domDriverName) {
  if (typeof defFnOutput !== 'object') {
    throw new Error('Custom element definition function should output an ' +
      'object.');
  }
  if (typeof defFnOutput[domDriverName] === 'undefined') {
    throw new Error(`Custom element definition function should output an ` +
      `object containing '${domDriverName}'.`);
  }
  if (typeof defFnOutput[domDriverName].subscribe !== 'function') {
    throw new Error(`Custom element definition function should output an ` +
      `object containing an Observable of VTree, named '${domDriverName}'.`);
  }
  for (let name in defFnOutput) { if (defFnOutput.hasOwnProperty(name)) {
    if (name !== domDriverName && name !== EVENTS_SINK_NAME) {
      throw new Error(`Unknown '${name}' found on custom element definition ` +
        `function's output.`);
    }
  }}
}

function makeInit(tagName, definitionFn) {
  let {makeDOMDriverWithRegistry} = require('./render-dom');
  return function initCustomElement() {
    //console.log('%cInit() custom element ' + tagName, 'color: #880088');
    let widget = this;
    let driverName = widget.driverName;
    let registry = widget.customElementsRegistry;
    let element = createContainerElement(tagName, widget.properties);
    let proxyVTree$$ = new Rx.AsyncSubject();
    let domDriver = makeDOMDriverWithRegistry(element, registry);
    let propertiesDriver = makePropertiesDriver();
    let domOutput = domDriver(proxyVTree$$.mergeAll(), driverName);
    let rootElem$ = domOutput.get(':root');
    let defFnInput = makeCustomElementInput(
      domOutput, propertiesDriver, driverName
    );
    let defFnOutput = definitionFn(defFnInput);
    validateDefFnOutput(defFnOutput, driverName);
    proxyVTree$$.onNext(defFnOutput[driverName].shareReplay(1));
    proxyVTree$$.onCompleted();
    rootElem$.subscribe(widget.firstRootElem$.asObserver());
    element.cycleCustomElementMetadata = {
      propertiesDriver,
      rootElem$,
      customEvents: defFnOutput.events,
      eventDispatchingSubscription: false
    };
    subscribeEventDispatchingSink(element, widget);
    //widget.disposables.add(domOutput.someDisposable); // TODO?
    widget.disposables.add(widget.firstRootElem$);
    widget.disposables.add(proxyVTree$$);
    widget.update(null, element);
    return element;
  };
}

function validatePropertiesDriverInMetadata(element, fnName) {
  if (!element) {
    throw new Error(`Missing DOM element when calling ${fnName} on custom ` +
      'element Widget.');
  }
  if (!element.cycleCustomElementMetadata) {
    throw new Error('Missing custom element metadata on DOM element when ' +
      'calling ' + fnName + ' on custom element Widget.');
  }
  let metadata = element.cycleCustomElementMetadata;
  if (metadata.propertiesDriver.type !== 'PropertiesDriver') {
    throw new Error('Custom element metadata\'s propertiesDriver type is ' +
      'invalid: ' + metadata.propertiesDriver.type + '.');
  }
}

function updateCustomElement(previous, element) {
  if (previous) {
    this.disposables = previous.disposables;
    this.firstRootElem$.onNext(0);
    this.firstRootElem$.onCompleted();
  }
  validatePropertiesDriverInMetadata(element, 'update()');

  //console.log(`%cupdate() ${element.className}`, 'color: #880088');
  let propsDriver = element.cycleCustomElementMetadata.propertiesDriver;
  if (propsDriver.hasOwnProperty(ALL_PROPS)) {
    propsDriver[ALL_PROPS].onNext(this.properties);
  }
  for (let prop in propsDriver) { if (propsDriver.hasOwnProperty(prop)) {
    if (this.properties.hasOwnProperty(prop)) {
      propsDriver[prop].onNext(this.properties[prop]);
    }
  }}
}

function destroyCustomElement(element) {
  //console.log(`%cdestroy() custom el ${element.className}`, 'color: #808');
  // Dispose propertiesDriver
  let propsDriver = element.cycleCustomElementMetadata.propertiesDriver;
  for (let prop in propsDriver) { if (propsDriver.hasOwnProperty(prop)) {
    this.disposables.add(propsDriver[prop]);
  }}
  if (element.cycleCustomElementMetadata.eventDispatchingSubscription) {
    // This subscription has to be disposed.
    // Because disposing subscribeDispatchersWhenRootChanges only
    // is not enough.
    this.disposables.add(
      element.cycleCustomElementMetadata.eventDispatchingSubscription
    );
  }
  this.disposables.dispose();
}

function makeWidgetClass(tagName, definitionFn) {
  if (typeof definitionFn !== 'function') {
    throw new Error('A custom element definition given to the DOM driver ' +
      'should be a function.');
  }

  let WidgetClass = makeConstructor();
  WidgetClass.definitionFn = definitionFn; // needed by renderAsHTML
  WidgetClass.prototype.init = makeInit(tagName, definitionFn);
  WidgetClass.prototype.update = updateCustomElement;
  WidgetClass.prototype.destroy = destroyCustomElement;
  return WidgetClass;
}

module.exports = {
  makeDispatchFunction,
  subscribeDispatchers,
  subscribeDispatchersWhenRootChanges,
  makePropertiesDriver,
  createContainerElement,
  warnIfVTreeHasNoKey,
  throwIfVTreeHasPropertyChildren,
  makeConstructor,
  makeInit,
  updateCustomElement,
  destroyCustomElement,
  makeCustomElementInput,

  makeWidgetClass
};
