// tabrador.js
// This contains the main content script - loaded once the DOM is

console.debug("Tabrador Loaded. Woof.");

var _box;
var _icon;
var _iconId = "tabrador-icon";
var _iconSize = 40;
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

// TODO: Also close on keypress/escape

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
        _box.style.border = "2px dotted #b19267";
        _box.style.background = "rgba(239, 197, 137, 0.2)";
        _box.style.position = "absolute";
        _box.style.zIndex = 2147483647;
        _box.style.visibility = "hidden";

        _icon = document.createElement("img");
        _icon.setAttribute("id", _iconId);
        var iconUrl = browser.extension.getURL("icons/icon-48.png");
        _icon.setAttribute("src", iconUrl);
        _icon.style.height = _iconSize + "px";
        _icon.style.width = _iconSize + "px";
        _icon.style.position = "absolute";
        _icon.style.zIndex = 2147483647;
        _icon.style.visibility = "hidden";

        // TODO - Add link count

        document.body.appendChild(_box);
        document.body.appendChild(_icon);
    }

    // Update position
    _box.x = event.pageX;
    _box.y = event.pageY;

    updateBox(event);

    // Now listen for mousemove
    // var debouncedOnMouseMove = debounce(onMouseMove, 50, true);
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
    var debouncedCollectSelectedLinks = debounce(collectSelectedLinks, 100, true);
    debouncedCollectSelectedLinks();
    // collectSelectedLinks();        
    _box.style.visibility = "visible";
    _icon.style.visibility = "visible";
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
    $("#" + _iconId).remove();

    _box = undefined;
    _icon = undefined;
    
    _dragHappened = false;
    _selectedLinks = [];

    // Remove all annotations
    undecorateLinkElements();

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
        } else {
            // Undecorate in case it was previously decorated
            undecorateLinkElement(linkElement);            
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

    var linkX1 = pos.x;
    var linkX2 = linkX1 + width;
    var linkY1 = pos.y;
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
 * Un-decorate all decorated elements
 */
function undecorateLinkElements(linkElement) {
    console.debug("undecorateLinkElements");
    $("." + _selectedLinkClass).removeClass(_selectedLinkClass);
}

/**
 * Un-decorate a given element to remove the special "selected" class
 * @param {*} linkElement 
 */
function undecorateLinkElement(linkElement) {
    console.debug("undecorateLinkElement");
    $(linkElement).removeClass(_selectedLinkClass);
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

    var documentWidth = Math.max(document.documentElement["clientWidth"], document.body["scrollWidth"], document.documentElement["scrollWidth"], document.body["offsetWidth"], document.documentElement["offsetWidth"]);  // taken from jquery
	var documentHeight = Math.max(document.documentElement["clientHeight"], document.body["scrollHeight"], document.documentElement["scrollHeight"], document.body["offsetHeight"], document.documentElement["offsetHeight"]);  // taken from jquery

    _box.x1 = Math.min(_box.x, event.pageX);
    _box.x2 = Math.max(_box.x, event.pageX);
    _box.y1 = Math.min(_box.y, event.pageY);
    _box.y2 = Math.max(_box.y, event.pageY);

    // Take the minimum of:
    // 1) The maximum width/height we could possibly fill, e.g. the width/height of the client, minus any left/top offset
    // 2) The calculated width/height given the starting and ending coordinates
    // This is to prevent dragging off the page
    var width = Math.min((documentWidth-_box.x1), (_box.x2-_box.x1));
    var height = Math.min((documentWidth-_box.y1), (_box.y2-_box.y1));

    if (width === 0 || height === 0) {
        return;
    }

    _box.style.left = _box.x1 + "px";
	_box.style.top = _box.y1 + "px";

    _box.style.width = width-3 + "px"; // -3 because the cursor was always slightly off target
    _box.style.height = height-3 + "px"; // -3 because the cursor was always slightly off target
    
    _icon.style.left = _box.x - (_iconSize/2) + "px";
	_icon.style.top = _box.y - (_iconSize/2) + "px";
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