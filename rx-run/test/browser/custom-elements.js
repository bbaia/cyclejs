'use strict';
/* global describe, it, beforeEach */
let assert = require('assert');
let Cycle = require('../../src/core/cycle');
let CustomElements = require('../../src/web/custom-elements');
let {Rx, h} = Cycle;

function createRenderTarget() {
  let element = document.createElement('div');
  element.className = 'cycletest';
  document.body.appendChild(element);
  return element;
}

describe('Custom Elements', function () {
  beforeEach(function () {
    Array.prototype.slice.call(document.querySelectorAll('.cycletest'))
      .forEach(function (x) {
        if (x.remove) {
          x.remove();
        }
      });
  });

  describe('Registry on makeDOMDriver', function () {
    it('should throw error if definitionFn is not a function', function () {
      let element = createRenderTarget();
      assert.throws(function () {
        Cycle.makeDOMDriver(element, {'my-elem': 123});
      }, /definition given to the DOM driver should be a function/i);
    });

    it('should not throw error if given correct parameters', function () {
      let element = createRenderTarget();
      assert.doesNotThrow(function () {
        Cycle.makeDOMDriver(element, {'my-elem': function myElem() {}});
      });
    });
  });

  it('should recognize and create simple element that is registered', function (done) {
    // Make simple custom element
    function myElementDef() {
      return {
        DOM: Rx.Observable.just(h('h3.myelementclass'))
      };
    }
    // Use the custom element
    function app() {
      return {
        DOM: Rx.Observable.just(h('div.toplevel', [h('my-element', {key: 1})]))
      };
    }
    let [requests, responses] = Cycle.run(app, {
      DOM: Cycle.makeDOMDriver(createRenderTarget(), {
        'my-element': myElementDef
      })
    });
    // Make assertions
    responses.DOM.get(':root').first().subscribe(function (root) {
      let myElement = root.querySelector('.myelementclass');
      assert.notStrictEqual(myElement, null);
      assert.notStrictEqual(typeof myElement, 'undefined');
      assert.strictEqual(myElement.tagName, 'H3');
      responses.dispose();
      done();
    });
  });

  it('should render inner state and properties independently', function (done) {
    // Make custom element with internal state, and properties as input
    function myElementDef(ext) {
      let number$ = Rx.Observable.interval(10).take(9);
      return {
        DOM: Rx.Observable.combineLatest(ext.props.get('color'), number$,
          function (color, number) {
            return h('h3.stateful-element', {style: {color}}, String(number));
          }
        )
      };
    }
    // Use the custom element
    function app() {
      return {
        DOM: Rx.Observable.just('#00FF00').delay(50)
          .startWith('#FF0000')
          .map(color =>
            h('div', [
              h('my-element', {key: 1, 'color': color})
            ])
        )
      };
    }
    let [requests, responses] = Cycle.run(app, {
      DOM: Cycle.makeDOMDriver(createRenderTarget(), {
        'my-element': myElementDef
      })
    });
    // Make assertions
    setTimeout(function () {
      let myElement = document.querySelector('.stateful-element');
      assert.notStrictEqual(myElement, null);
      assert.notStrictEqual(typeof myElement, 'undefined');
      assert.strictEqual(myElement.tagName, 'H3');
      assert.strictEqual(myElement.textContent, '8');
      assert.strictEqual(myElement.style.color, 'rgb(0, 255, 0)');
      responses.dispose();
      done();
    }, 500);
  });

  it('should have Observable properties object as props.get(\'*\')', function (done) {
    // Make custom element
    function myElementDef(ext) {
      return {
        DOM: ext.props.get('*').map(propsObj => {
          assert.strictEqual(typeof propsObj, 'object');
          assert.notStrictEqual(propsObj, null);
          assert.strictEqual(propsObj.color, '#FF0000');
          assert.strictEqual(propsObj.content, 'Hello world');
          return h('h3.inner-element',
            {style: {color: propsObj.color}},
            String(propsObj.content)
          );
        })
      };
    }
    function app() {
      return {
        DOM: Rx.Observable.just(
          h('div', [
            h('my-element', {color: '#FF0000', content: 'Hello world'})
          ])
        )
      };
    }
    let [requests, responses] = Cycle.run(app, {
      DOM: Cycle.makeDOMDriver(createRenderTarget(), {
        'my-element': myElementDef
      })
    });
    // Make assertions
    responses.DOM.get(':root').first().subscribe(function (root) {
      let myElement = root.querySelector('.inner-element');
      assert.notStrictEqual(myElement, null);
      assert.notStrictEqual(typeof myElement, 'undefined');
      assert.strictEqual(myElement.tagName, 'H3');
      assert.strictEqual(myElement.textContent, 'Hello world');
      assert.strictEqual(myElement.style.color, 'rgb(255, 0, 0)');
      responses.dispose();
      done();
    });
  });

  it('should have Observable properties object as props.getAll()', function (done) {
    // Make custom element
    function myElementDef(ext) {
      return {
        DOM: ext.props.getAll().map(propsObj => {
          assert.strictEqual(typeof propsObj, 'object');
          assert.notStrictEqual(propsObj, null);
          assert.strictEqual(propsObj.color, '#FF0000');
          assert.strictEqual(propsObj.content, 'Hello world');
          return h('h3.inner-element',
            {style: {color: propsObj.color}},
            String(propsObj.content)
          );
        })
      };
    }
    function app() {
      return {
        DOM: Rx.Observable.just(
          h('div', [
            h('my-element', {color: '#FF0000', content: 'Hello world'})
          ])
        )
      };
    }
    let [requests, responses] = Cycle.run(app, {
      DOM: Cycle.makeDOMDriver(createRenderTarget(), {
        'my-element': myElementDef
      })
    });
    // Make assertions
    responses.DOM.get(':root').first().subscribe(function (root) {
      let myElement = root.querySelector('.inner-element');
      assert.notStrictEqual(myElement, null);
      assert.notStrictEqual(typeof myElement, 'undefined');
      assert.strictEqual(myElement.tagName, 'H3');
      assert.strictEqual(myElement.textContent, 'Hello world');
      assert.strictEqual(myElement.style.color, 'rgb(255, 0, 0)');
      responses.dispose();
      done();
    });
  });

  it('should throw if properties driver getter has no args', function (done) {
    // Make custom element
    function myElementDef(ext) {
      return {
        DOM: ext.props.get().map(propsObj =>
          h('h3.inner-element',
            {style: {color: propsObj.color}},
            String(propsObj.content)
          )
        )
      };
    }
    function app() {
      return {
        DOM: Rx.Observable.just(
          h('div', [
            h('my-element', {color: '#FF0000', content: 'Hello world'})
          ])
        )
      };
    }
    let [requests, responses] = Cycle.run(app, {
      DOM: Cycle.makeDOMDriver(createRenderTarget(), {
        'my-element': myElementDef
      })
    });
    // Make assertions
    responses.DOM.get(':root').first().subscribe(
      function onNextHandler() {
        assert.fail('DOM :root Observable should not emit onNext.');
      },
      function onErrorHandler(err) {
        assert.strictEqual(err.message, 'Custom element driver `props.get()` ' +
          'expects an argument in the getter.'
        );
        done();
      }
    );
  });

  it('should recognize and create two unrelated elements', function (done) {
    // Make the first custom element
    function myElementDef1() {
      return {
        DOM: Rx.Observable.just(h('h1.myelement1class'))
      };
    }
    // Make the second custom element
    function myElementDef2() {
      return {
        DOM: Rx.Observable.just(h('h2.myelement2class'))
      };
    }
    // Use the custom elements
    function app() {
      return {
        DOM: Rx.Observable.just(
          h('div', [
            h('my-element1'), h('my-element2')
          ])
        )
      };
    }
    let [requests, responses] = Cycle.run(app, {
      DOM: Cycle.makeDOMDriver(createRenderTarget(), {
        'my-element1': myElementDef1,
        'my-element2': myElementDef2
      })
    });
    // Make assertions
    responses.DOM.get(':root').first().subscribe(function (root) {
      let myElement1 = root.querySelector('.myelement1class');
      let myElement2 = root.querySelector('.myelement2class');
      assert.notStrictEqual(myElement1, null);
      assert.notStrictEqual(typeof myElement1, 'undefined');
      assert.strictEqual(myElement1.tagName, 'H1');
      assert.notStrictEqual(myElement2, null);
      assert.notStrictEqual(typeof myElement2, 'undefined');
      assert.strictEqual(myElement2.tagName, 'H2');
      responses.dispose();
      done();
    });
  });

  it('should recognize and create a nested custom elements', function (done) {
    // Make the inner custom element
    function innerElementDef() {
      return {
        DOM: Rx.Observable.just(h('h3.innerClass'))
      };
    }
    // Make the outer custom element
    function outerElementDef() {
      return {
        DOM: Rx.Observable.just(
          h('div.outerClass', [
            h('inner-element', {key: 1})
          ])
        )
      };
    }
    // Use the custom elements
    function app() {
      return {
        DOM: Rx.Observable.just(h('div', [h('outer-element', {key: 2})]))
      };
    }
    let [requests, responses] = Cycle.run(app, {
      DOM: Cycle.makeDOMDriver(createRenderTarget(), {
        'inner-element': innerElementDef,
        'outer-element': outerElementDef
      })
    });
    // Make assertions
    responses.DOM.get(':root').first().subscribe(function (root) {
      let innerElement = root.querySelector('.innerClass');
      assert.notStrictEqual(innerElement, null);
      assert.notStrictEqual(typeof innerElement, 'undefined');
      assert.strictEqual(innerElement.tagName, 'H3');
      responses.dispose();
      done();
    });
  });

  it('should catch custom element\'s interaction events', function (done) {
    // Make simple custom element
    function myElementDef() {
      return {
        DOM: Rx.Observable.just(h('h3.myelementclass', 'foobar')),
        events: {
          myevent: Rx.Observable.just(123).delay(300)
        }
      };
    }
    // Use the custom element
    function app() {
      return {
        DOM: Rx.Observable.just(h('div.toplevel', [
          h('my-element.eventsource', {key: 1})
        ]))
      };
    }
    let [requests, responses] = Cycle.run(app, {
      DOM: Cycle.makeDOMDriver(createRenderTarget(), {
        'my-element': myElementDef
      })
    });
    // Make assertions
    Rx.Observable.combineLatest(
      responses.DOM.get(':root').first(),
      responses.DOM.get('.eventsource', 'myevent'),
      (root, event) => ({root, event})
    )
    .subscribe(({root, event}) => {
      assert.strictEqual(event.type, 'myevent');
      assert.strictEqual(event.detail, 123);
      let myElement = root.querySelector('.myelementclass');
      assert.notStrictEqual(myElement, null);
      assert.notStrictEqual(typeof myElement, 'undefined');
      assert.strictEqual(myElement.tagName, 'H3');
      responses.dispose();
      done();
    });
  });

  it('should warn when custom element is used with no key', function (done) {
    let realConsole = console;
    let warnMessages = [];
    let noop = () => {};
    console = {
      log: noop,
      error: noop,
      warn: (msg) => warnMessages.push(msg)
    };
    // Make simple custom element
    function myElementDef() {
      return {
        DOM: Rx.Observable.just(h('h3.myelementclass'))
      };
    }
    // Make VNode with a string as child
    function app() {
      return {
        DOM: Rx.Observable.just(h('div', h('my-element')))
      };
    }
    let [requests, responses] = Cycle.run(app, {
      DOM: Cycle.makeDOMDriver(createRenderTarget(), {
        'my-element': myElementDef
      })
    });
    responses.DOM.get(':root').first().subscribe(function () {
      console = realConsole;
      assert.strictEqual(warnMessages.length, 1);
      assert.strictEqual(warnMessages[0],
        'Missing `key` property for Cycle custom element MY-ELEMENT'
      );
      responses.dispose();
      done();
    });
  });

  it('should not fail when finds VirtualText in replaceCustomElements', function (done) {
    // Make simple custom element
    function myElementDef() {
      return {
        DOM: Rx.Observable.just(h('h3.myelementclass'))
      };
    }
    // Make VNode with a string as child
    function app() {
      return {
        DOM: Rx.Observable.just(h('h1', 'This will be a VirtualText'))
      };
    }
    // Make assertions
    let [requests, responses] = Cycle.run(app, {
      DOM: Cycle.makeDOMDriver(createRenderTarget(), {
        'my-element': myElementDef
      })
    });
    responses.DOM.get(':root').subscribeOnError(err => {
      assert.fail(null, null, err);
    });
    setTimeout(() => {
      responses.dispose();
      done();
    }, 500);
  });

  it('should not miss custom events from a list of custom elements #87', function (done) {
    // Make custom element
    function sliderDef(ext) {
      let remove$ = ext.DOM.get('.internalslider', 'click').map(() => true);
      let id$ = ext.props.get('id').shareReplay(1);
      let vtree$ = id$.map(id => h('h3.internalslider', String(id)));
      return {
        DOM: vtree$,
        events: {
          remove: remove$.withLatestFrom(id$, (r, id) => id)
        }
      };
    }

    function app(ext) {
      return {
        DOM: Rx.Observable
          .merge(
            Rx.Observable.just([{id: 23}]),
            Rx.Observable.just([{id: 23}, {id: 45}]).delay(50),
            ext.DOM.get('.slider', 'remove').map(event => event.detail)
          )
          .scan((items, x) => {
            if (typeof x === 'object') {
              return x;
            } else {
              return items.filter((item) => item.id !== x);
            }
          })
          .map(items =>
            h('div.allSliders', items.map(item => h('slider-elem.slider', {id: item.id})))
          )
      };
    }

    let [requests, responses] = Cycle.run(app, {
      DOM: Cycle.makeDOMDriver(createRenderTarget(), {
        'slider-elem': sliderDef
      })
    });

    responses.DOM.get(':root').first().subscribe(function (root) {
      debugger;
      // Simulate clicks
      setTimeout(() => root.querySelector('.internalslider').click(), 200);
      setTimeout(() => root.querySelector('.internalslider').click(), 300);

      // Make assertion
      setTimeout(() => {
        let sliders = root.querySelectorAll('.internalslider');
        assert.strictEqual(sliders.length, 0);
        responses.dispose();
        done();
      }, 500);
    });
  });

  it('should recognize nested vtree as properties.get(\'children\')', function (done) {
    // Make simple custom element
    function simpleWrapperDef(ext) {
      return {
        DOM: ext.props.get('children').map(children => {
          return h('div.wrapper', children);
        })
      };
    }
    // Use the custom element
    function app() {
      return {
        DOM: Rx.Observable.just(h('div.toplevel', [
          h('simple-wrapper', [
            h('h1', 'Hello'), h('h2', 'World')
          ])
        ]))
      };
    }
    let [requests, responses] = Cycle.run(app, {
      DOM: Cycle.makeDOMDriver(createRenderTarget(), {
        'simple-wrapper': simpleWrapperDef
      })
    });
    // Make assertions
    responses.DOM.get(':root').first().subscribe(function (root) {
      let wrapper = root.querySelector('.wrapper');
      assert.notStrictEqual(wrapper, null);
      assert.notStrictEqual(typeof wrapper, 'undefined');
      assert.strictEqual(wrapper.tagName, 'DIV');
      responses.dispose();
      done();
    });
  });

  it('should throw error if children property is explicitly used', function (done) {
    // Make simple custom element
    function myElementDef() {
      return {
        DOM: Rx.Observable.just(h('h3.myelementclass'))
      };
    }
    // Use the custom element
    function app() {
      return {
        DOM: Rx.Observable.just(h('div.toplevel', [
          h('my-element', {children: 123})
        ]))
      };
    }
    let [requests, responses] = Cycle.run(app, {
      DOM: Cycle.makeDOMDriver(createRenderTarget(), {
        'my-element': myElementDef
      })
    });
    responses.DOM.get(':root').subscribeOnError((err) => {
      assert.strictEqual(err.message, 'Custom element should not have ' +
        'property `children`. It is reserved for children elements nested ' +
        'into this custom element.'
      );
      responses.dispose();
      done();
    });
  });

  it('should recognize changes on a mutable collection given as props', function (done) {
    function xElementDef(ext) {
      return {
        DOM: ext.props.get('list', () => false).map(list =>
          h('div', [
            h('ol', list.map(value => h('li.test-item', null, value)))
          ]))
      };
    }

    let counter = 0;
    function app(ext) {
      let clickMod$ = ext.DOM.get('.button', 'click')
        .map(() => `item${++counter}`)
        .map(random => function mod(data) {
          data.push(random);
          return data;
        });
      return {
        DOM: clickMod$
          .startWith([])
          .scan((data, modifier) => modifier(data))
          .map(data => h('.root', [
            h('button.button', 'add new item'),
            h('x-element', {key: 0, list: data})
          ]))
      };
    }

    let [requests, responses] = Cycle.run(app, {
      DOM: Cycle.makeDOMDriver(createRenderTarget(), {
        'x-element': xElementDef
      })
    });

    responses.DOM.get(':root').first().subscribe(function (root) {
      setTimeout(() => root.querySelector('.button').click(), 100);
      setTimeout(() => root.querySelector('.button').click(), 200);
      setTimeout(() => {
        let items = root.querySelectorAll('li.test-item');
        assert.strictEqual(items.length, 2);
        assert.strictEqual(items[0].textContent, 'item1');
        assert.strictEqual(items[1].textContent, 'item2');
        responses.dispose();
        done();
      }, 500);
    });
  });

  it('should emit events even when dynamically evolving', function (done) {
    // Make simple custom element
    function myElementDef() {
      // Here the vtree changes from <h3> to <button>, the myevent should
      // be emitted on <button> and not from the original <h3>.
      return {
        DOM: Rx.Observable.merge(
          Rx.Observable.just(h('h3.myelementclass', 'foo')),
          Rx.Observable.just(h('button.myelementclass', 'bar')).delay(50)
        ),
        events: {
          myevent: Rx.Observable.just(123).delay(300)
        }
      };
    }
    // Use the custom element
    function app() {
      return {
        DOM: Rx.Observable.just(
          h('div.toplevel', [
            h('my-element.eventsource', {key: 1})
          ])
        )
      };
    }
    let [requests, responses] = Cycle.run(app, {
      DOM: Cycle.makeDOMDriver(createRenderTarget(), {
        'my-element': myElementDef
      })
    });
    // Make assertions
    responses.DOM.get(':root').first().subscribe(function (root) {
      let myElement = root.querySelector('.myelementclass');
      assert.notStrictEqual(myElement, null);
      assert.notStrictEqual(typeof myElement, 'undefined');
      assert.strictEqual(myElement.tagName, 'H3');
    });
    responses.DOM.get('.eventsource', 'myevent').subscribe(function (event) {
      assert.strictEqual(event.type, 'myevent');
      assert.strictEqual(event.detail, 123);
      assert.strictEqual(event.target.tagName, 'BUTTON');
      responses.dispose();
      done();
    });
  });

  it('should dispose vtree$ after destruction', function (done) {
    let log = [];
    let number$ = Rx.Observable.range(1, 2).controlled();
    let customElementSwitch$ = Rx.Observable.range(0, 2).controlled();
    // Make simple custom element
    function myElementDef() {
      return {
        DOM: number$
          .do(i => log.push(i))
          .map(i => h('h3.myelementclass', String(i)))
      };
    }
    // Use the custom element
    function app() {
      return {
        DOM: customElementSwitch$.map(theSwitch => {
          return theSwitch === 0
            ? h('div.toplevel', [h('my-element', {key: 1})])
            : h('div.toplevel', []);
        })
      };
    }
    let [requests, responses] = Cycle.run(app, {
      DOM: Cycle.makeDOMDriver(createRenderTarget(), {
        'my-element': myElementDef
      })
    });
    // Make assertions
    responses.DOM.get(':root').first().subscribe(function (root) {
      let myElement = root.querySelector('.myelementclass');
      assert.notStrictEqual(myElement, null);
      assert.notStrictEqual(typeof myElement, 'undefined');
      assert.strictEqual(myElement.tagName, 'H3');
      assert.strictEqual(log.length, 1);
      // Destroy the element
      customElementSwitch$.request(1);
    });
    responses.DOM.get(':root').skip(1).subscribe(function (root) {
      let destroyedElement = root.querySelector('.myelementclass');
      assert.strictEqual(destroyedElement, null);
      assert.notStrictEqual(log.length, 2);
      responses.dispose();
      done();
    });
    customElementSwitch$.request(1);
    number$.request(1);
  });

  it('should not emit events after destruction', function (done) {
    let log = [];
    let number$ = Rx.Observable.range(1, 3).controlled();
    let customElementSwitch$ = Rx.Observable.range(0, 2).controlled();
    // Make simple custom element
    function myElementDef() {
      return {
        DOM: Rx.Observable.just(h('h3.myelementclass')),
        events: {
          myevent: number$.do(i => log.push(i))
        }
      };
    }
    // Use the custom element
    function app() {
      return {
        DOM: customElementSwitch$.map(theSwitch => {
          return theSwitch === 0
            ? h('div.toplevel', [h('my-element', {key: 1})])
            : h('div.toplevel', []);
        })
      };
    }
    let [requests, responses] = Cycle.run(app, {
      DOM: Cycle.makeDOMDriver(createRenderTarget(), {
        'my-element': myElementDef
      })
    });
    // Make assertions
    let myEventDisposable;
    responses.DOM.get(':root').first().subscribe(function (root) {
      let myElement = root.querySelector('.myelementclass');
      assert.notStrictEqual(myElement, null);
      assert.notStrictEqual(typeof myElement, 'undefined');
      assert.strictEqual(myElement.tagName, 'H3');

      myEventDisposable = Rx.Observable.fromEvent(myElement, 'myevent')
        .take(3)
        .subscribe(function (ev) {
          assert.notStrictEqual(ev.detail, 3);
        });

      // Trigger the event
      number$.request(1);
      number$.request(1);

      // Destroy the element
      customElementSwitch$.request(1);
    });
    responses.DOM.get(':root').skip(1).subscribe(function (root) {
      let destroyedElement = root.querySelector('.myelementclass');
      assert.strictEqual(destroyedElement, null);

      // Trigger event after the element has been destroyed
      number$.request(1);
      assert.notStrictEqual(log.length, 3);

      responses.dispose();
      myEventDisposable.dispose();
      done();
    });
    customElementSwitch$.request(1);
  });
});
