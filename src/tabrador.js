// tabrador.js
// This contains the main content script - loaded once the DOM is

console.debug("Tabrador Loaded. Woof.");

var _box;
var _boxId = "tabrador-selection-box";
var _selectedLinkClass = "tabrador-selected";
var _count_label;
var _dragHappened = false;
var _preventContext = false;
var _allLinks = [];
var _selectedLinks = [];

// Identify  all links at the start. Populates _allLinks
collectAllLinks();

// Listen for mousedown
$("body").mousedown(function(event) {
    console.debug("mouse down - " + event.which);
    
    switch (event.which) {
        case 3:
            onRightMouseDown(event);
            break;
        default:
            cleanUp();
            break;
    }
});

// Listen for mouseup
$("body").mouseup(function(event) {
    switch (event.which) {
        case 3:
            onRightMouseUp(event);
            break;
    }
});

// Prevent context menu
$("body").contextmenu(function(event) {
    console.debug("contextmenu - _preventContext is " + _preventContext);
    if (_preventContext) {
        event.preventDefault();
    }
});

/**
 * Handle right-click of the mouse. Create the box and hook up mousemove.
 * @param {*} event 
 */
function onRightMouseDown(event) {
    console.debug('Right Mouse button DOWN -- ' + _preventContext);

    preventEscalation(event);    
    
    // Create the box
    if (!_box) {
        // TODO use class instead
        _box = document.createElement("span");
        _box.setAttribute("id", _boxId);
        _box.style.margin = "0px auto";
        _box.style.border = "2px dotted red";
        _box.style.position = "absolute";
        _box.style.zIndex = 2147483647;
        _box.style.visibility = "hidden";

        // TODO - Add tabrador head & link count

        document.body.appendChild(_box);
    }

    // Update position
    _box.x = event.pageX;
    _box.y = event.pageY;

    updateBox(event);

    // Now listen for mousemove
    $("body").mousemove(onMouseMove);
}

/**
 * Update box while the mouse is moving. We can assume this code will only run
 * when the box is active, since that is the only time the event is hooked up.
 * @param {*} event 
 */
function onMouseMove(event) {
    _dragHappened = true;

    // TODO: Debounce this work so we're not hammering the browser. 10 times a second should be plenty
    updateBox(event);    
    collectSelectedLinks();        
    _box.style.visibility = "visible";
}

/**
 * Prevent events from propagating
 * @param {*} event 
 */
function preventEscalation(event){
	event.stopPropagation();
	event.preventDefault();
}

/**
 * Handle right-mouse-up. This marks the end of a drag for us - which means
 * opening all links then cleaning up after ourselves.
 * @param {*} event 
 */
function onRightMouseUp(event) {
    console.debug('Right Mouse button UP -- ' + _dragHappened);

    preventEscalation(event);

    if (_dragHappened) {
        // Only if the mouse is moving and we're showing a box,
        // then prevent a context menu. This shouldn't prevent a "regular" right click
        // without dragging...
        console.debug("SETTING preventContext to true");        
        _preventContext = true;            

        setTimeout(function() {
            console.debug("SETTING preventContext to false");
            _preventContext = false;        
        }, 100);
    }

    openLinks(); 
}

/**
 * Clean up after ourselves. Remove the box and our CSS classes from the DOM, and unhook mousemove.
 */
function cleanUp() {
    console.debug("cleanUp");
    
    $("#" + _boxId).remove();
    _box = undefined;
    _dragHappened = false;
    _selectedLinks = [];

    // Remove all annotations
    $(_selectedLinkClass).removeClass(_selectedLinkClass);

    // Remove mousemove listener
    $('body').off('mousemove');

}

/**
 * Take the _selectedLinks array and send in a message to the background thread
 * to open them in new tabs.
 */
function openLinks() {
    console.debug("openLinks. We have " + _selectedLinks.length + " to open");

    // Open the links
    var linkUrls = [];

    for (var i = 0; i < _selectedLinks.length; i++) {
        var url = _selectedLinks[i].href;

        // Only add if unique
        if (linkUrls.indexOf(url) === -1) {
            linkUrls.push(url);
        }
    }

    if (linkUrls.length > 0) {
        browser.runtime.sendMessage({
            action: "openUrls",
            urls: linkUrls
        });
    }
    
    // Then remove the box
    cleanUp();    
}

/**
 * Loop through all links on the page and work out which of them are
 * currently overlapping our selection box.
 */
function collectSelectedLinks() {
    console.debug("collectSelectedLinks - " + _allLinks.length + " length");

    _selectedLinks = [];
    
    for (var i = 0; i < _allLinks.length; i++) {
        var linkElement = _allLinks[i];

        if (boxIntersectsWith(linkElement)) {
            console.debug("INTERSECTION!!! " + linkElement);
        
            decorateLinkElement(linkElement);
            _selectedLinks.push(linkElement);
        }
    }
}

/**
 * Given an element, work out if it's overlapping our selection box.
 * @param {*} linkElement 
 */
function boxIntersectsWith(linkElement) {
    
    var pos = this.getXY(linkElement);
    var width = linkElement.offsetWidth;
    var height = linkElement.offsetHeight;

    var linkX1 = pos.x + 7;
    var linkX2 = linkX1 + width;
    var linkY1 = pos.y + 7;
    var linkY2 = linkY1 + height;

    if (!(linkX1 > _box.x2 || linkX2 < _box.x1 || linkY1 > _box.y2 || linkY2 < _box.y1)) {
        return true;
    } else {
        return false;
    }
}

/**
 * Get position of an element
 * @param {*} element 
 */
function getXY(element) {
	var x = 0;
	var y = 0;
	var parent = element;
	do {
		x += parent.offsetLeft;
		y += parent.offsetTop;
	} while(parent = parent.offsetParent);

	parent = element;
	while(parent && parent !== document.body) {
		if(parent.scrollleft) {
			x -= parent.scrollLeft;
		}
		if(parent.scrollTop) {
			y -= parent.scrollTop;
		}
		parent = parent.parentNode;
	}

	return {x:x, y:y};
}

/**
 * Decorate a given element with the special "selected" class
 * @param {*} linkElement 
 */
function decorateLinkElement(linkElement) {
    console.debug("decorateLinkElement");
    $(linkElement).addClass(_selectedLinkClass);
}

/**
 * Identify all <a> elements on the page
 */
function collectAllLinks() {
    console.debug("collectAllLinks");
    
    _allLinks = $("a");

    // TODO: ignore javascript links

    console.debug("collected " + _allLinks.length + " links");
}

/**
 * Update the size and position of the selection box given the latest event.
 * @param {*} event 
 */
function updateBox(event) {
    // TODO - this only works for dragging from left-to-right
    // Need to draw a box which works in the reverse

    var width = Math.max((_box.x - event.pageX), event.pageX - _box.x);
    var height = Math.max((_box.y - event.pageY), event.pageY - _box.y);

    _box.x1 = _box.x;
    _box.x2 = event.pageX; // TODO: -7?
    _box.y1 = _box.y;
    _box.y2 = event.pageY; // TODO: -7?

    _box.style.left = _box.x + "px";
	_box.style.top = _box.y + "px";

    _box.style.width = width + "px";
	_box.style.height = height + "px";
}

/**
 * Returns a function, that, as long as it continues to be invoked, will not
 * be triggered. The function will be called after it stops being called for
 * N milliseconds. If `immediate` is passed, trigger the function on the
 * leading edge, instead of the trailing.
 * (Stolen from https://davidwalsh.name/javascript-debounce-function)
 * @param {*} func 
 * @param {*} wait 
 * @param {*} immediate 
 */
function debounce(func, wait, immediate) {
	var timeout;
	return function() {
		var context = this, args = arguments;
		var later = function() {
			timeout = null;
			if (!immediate) func.apply(context, args);
		};
		var callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) func.apply(context, args);
	};
};