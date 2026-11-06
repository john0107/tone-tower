import test from 'node:test';
import assert from 'node:assert/strict';
import {bindMapNavigation} from './map-navigation.js';

class Element {
  constructor(tagName, parent = null, attributes = {}) {
    this.tagName = tagName.toUpperCase();
    this.parentElement = parent;
    this.attributes = attributes;
    this.dataset = {};
    for (const [key, value] of Object.entries(attributes)) {
      if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    }
    this.disabled = false;
  }
  matches(selector) {
    const match = selector.trim().match(/^(\w+)?(?:\[([\w-]+)(?:="([^"]+)")?\])?$/);
    return Boolean(match && (!match[1] || match[1].toUpperCase() === this.tagName) &&
      (!match[2] || Object.hasOwn(this.attributes, match[2]) && (match[3] === undefined || this.attributes[match[2]] === match[3])));
  }
  closest(selector) {
    for (let node = this; node; node = node.parentElement) if (selector.split(',').some(part => node.matches(part))) return node;
    return null;
  }
  contains(target) {
    for (let node = target; node; node = node.parentElement) if (node === this) return true;
    return false;
  }
  focus(options) {this.focusOptions = options; this.focused = true}
}

function harness(initial = 'tone') {
  const listeners = new Set(), document = {addEventListener(type, handler) {assert.equal(type, 'keydown');listeners.add(handler)}, removeEventListener(type, handler) {assert.equal(type, 'keydown');listeners.delete(handler)}};
  document.documentElement = new Element('html');
  document.body = new Element('body', document.documentElement);
  const container = new Element('main', document.body);
  const cards = Object.fromEntries(['tone', 'rail'].map(value => [value, new Element('button', container, {'data-mode-card':'', 'data-destination':value})]));
  container.querySelector = selector => cards[selector.match(/data-destination="([^"]+)"/)?.[1]];
  let selected = initial, blocked = false;
  const calls = [], cleanup = bindMapNavigation({document, container, getDestination:() => selected, onSelect:value => {selected=value;calls.push(['select', value])}, onStart:() => calls.push(['start', selected]), isBlocked:() => blocked});
  return {document, container, cards, calls, listeners, cleanup, get selected() {return selected}, block(value) {blocked=value}, key(key, target=document.body, extra={}) {
    const event = {key, target, defaultPrevented:false, preventDefault() {this.defaultPrevented=true}, ...extra};
    for (const listener of listeners) listener(event);
    return event;
  }};
}

test('all arrow keys navigate spatial mode order, wrap, and focus without scrolling', () => {
  const h = harness();
  for (const [key, value] of [['ArrowLeft','rail'], ['ArrowUp','tone'], ['ArrowRight','rail'], ['ArrowDown','tone']]) {
    assert.equal(h.key(key).defaultPrevented, true);
    assert.equal(h.selected, value);
    assert.equal(h.cards[value].focused, true);
    assert.deepEqual(h.cards[value].focusOptions, {preventScroll:true});
  }
  h.key('End');assert.equal(h.selected, 'rail');
  h.key('Home');assert.equal(h.selected, 'tone');
  h.cleanup();
});

test('Enter starts immediately, ignores repeats, and activates a mode reached with Tab', () => {
  const h = harness();
  assert.equal(h.key('Enter').defaultPrevented, true);
  assert.deepEqual(h.calls, [['start','tone']]);
  assert.equal(h.key('Enter', h.document.body, {repeat:true}).defaultPrevented, false);
  assert.equal(h.calls.length, 1);
  const label = new Element('span', h.cards.rail);
  assert.equal(h.key('Enter', label).defaultPrevented, true);
  assert.deepEqual(h.calls.slice(1), [['select','rail'], ['start','rail']]);
  h.cleanup();
});

test('map buttons and noninteractive content accept shortcuts within the home view', () => {
  const h = harness(), mapButton = new Element('button', h.container, {'data-destination':'rail'});
  assert.equal(h.key('ArrowRight', new Element('small', mapButton)).defaultPrevented, true);
  assert.equal(h.selected, 'rail');
  assert.equal(h.key('ArrowLeft', new Element('h1', h.container)).defaultPrevented, true);
  assert.equal(h.selected, 'tone');
  assert.equal(h.key('ArrowLeft', h.container).defaultPrevented, true);
  assert.equal(h.selected, 'rail');
  assert.equal(h.key('Enter', h.document.documentElement).defaultPrevented, true);
  assert.deepEqual(h.calls.at(-1), ['start','rail']);
  h.cleanup();
});

test('native controls, editable text and controls outside the map keep their keys', () => {
  const h = harness(), header = new Element('header', h.document.body);
  const editable = new Element('div', h.container, {contenteditable:''});
  const inheritedEditable = new Element('span', editable);
  inheritedEditable.isContentEditable = true;
  const controls = [
    new Element('a', header),
    new Element('button', header, {'data-destination':'rail'}),
    new Element('a', h.container),
    new Element('button', h.container, {'data-difficulty':'easy'}),
    new Element('button', h.container, {id:'start-adventure'}),
    new Element('input', h.container),
    new Element('textarea', h.container),
    new Element('select', h.container),
    new Element('summary', h.container),
    new Element('div', h.container, {role:'button'}),
    inheritedEditable,
    new Element('section', h.document.body)
  ];
  for (const control of controls) for (const key of ['ArrowRight','Enter']) {
    assert.equal(h.key(key, control).defaultPrevented, false, control.tagName + ' keeps ' + key);
  }
  assert.deepEqual(h.calls, []);
  h.cleanup();
});

test('dialogs, IME, modifiers, prevented events and unrelated keys never navigate or start', () => {
  const h = harness();
  for (const extra of [{isComposing:true},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true},{defaultPrevented:true}]) {
    h.key('ArrowRight', h.document.body, extra);
    h.key('Enter', h.cards.rail, extra);
  }
  h.key('Tab');h.key('Escape');h.key(' ');
  h.block(true);h.key('ArrowRight');h.key('Enter');
  assert.deepEqual(h.calls, []);
  h.block(false);h.key('ArrowRight');
  assert.equal(h.selected, 'rail');
  h.cleanup();
});

test('disabled destinations do not handle keys and cleanup removes the document listener', () => {
  const h = harness();
  h.cards.rail.disabled = true;
  h.key('ArrowRight', h.cards.rail);h.key('Enter', h.cards.rail);
  assert.deepEqual(h.calls, []);
  assert.equal(h.listeners.size, 1);
  h.cleanup();h.cleanup();
  assert.equal(h.listeners.size, 0);
  h.key('ArrowRight');h.key('Enter');
  assert.deepEqual(h.calls, []);
});
