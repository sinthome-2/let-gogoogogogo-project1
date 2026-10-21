/*
 *   This content is licensed according to the W3C Software License at
 *   https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
 */

// Derived from w3c/aria-practices dialog.js (main), W3C Software License. https://github.com/w3c/aria-practices/blob/main/content/patterns/dialog-modal/examples/js/dialog.js

'use strict';

window.FocusTrap = (function () {
  var IgnoreUtilFocusChanges = false;

  function isFocusable(element) {
    if (element.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }
    if (element.disabled) {
      return false;
    }
    var tag = element.tagName.toLowerCase();
    var hasHref = element.hasAttribute('href');
    var tabIndex = element.getAttribute('tabindex');
    var hasTabIndex = tabIndex !== null && parseInt(tabIndex, 10) >= 0;
    return (
      hasTabIndex ||
      (tag === 'a' && hasHref) ||
      tag === 'button' ||
      tag === 'input' ||
      tag === 'select' ||
      tag === 'textarea'
    );
  }

  function attemptFocus(element) {
    if (!isFocusable(element)) {
      return false;
    }
    IgnoreUtilFocusChanges = true;
    try {
      element.focus();
    } catch (e) {
      // continue regardless of error
    }
    IgnoreUtilFocusChanges = false;
    return document.activeElement === element;
  }

  function focusFirstDescendant(element) {
    for (var i = 0; i < element.childNodes.length; i++) {
      var child = element.childNodes[i];
      if (attemptFocus(child) || focusFirstDescendant(child)) {
        return true;
      }
    }
    return false;
  }

  function focusLastDescendant(element) {
    for (var i = element.childNodes.length - 1; i >= 0; i--) {
      var child = element.childNodes[i];
      if (attemptFocus(child) || focusLastDescendant(child)) {
        return true;
      }
    }
    return false;
  }

  function init(container, options) {
    options = options || {};
    var focusAfterClosed = options.focusAfterClosed;
    var lastFocus = null;
    var preNode = document.createElement('div');
    var postNode = document.createElement('div');
    preNode.tabIndex = 0;
    postNode.tabIndex = 0;

    container.parentNode.insertBefore(preNode, container);
    container.parentNode.insertBefore(postNode, container.nextSibling);

    document.body.classList.add('focus-trap-active');

    function trapFocus(event) {
      if (IgnoreUtilFocusChanges) {
        return;
      }
      if (container.contains(event.target)) {
        lastFocus = event.target;
      } else {
        focusFirstDescendant(container);
        if (lastFocus === document.activeElement) {
          focusLastDescendant(container);
        }
        lastFocus = document.activeElement;
      }
    }

    function close() {
      document.removeEventListener('focus', trapFocus, true);
      if (preNode.parentNode) preNode.parentNode.removeChild(preNode);
      if (postNode.parentNode) postNode.parentNode.removeChild(postNode);
      document.body.classList.remove('focus-trap-active');
      if (focusAfterClosed) {
        IgnoreUtilFocusChanges = true;
        focusAfterClosed.focus();
        IgnoreUtilFocusChanges = false;
      }
    }

    document.addEventListener('focus', trapFocus, true);
    focusFirstDescendant(container);
    lastFocus = document.activeElement;

    return { close: close };
  }

  return { init: init };
})();
