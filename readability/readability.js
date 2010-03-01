var dbg = function(s) {
    if(typeof console !== 'undefined') {
        console.log("Readability: " + s);
    }
};

/*
 * Readability. An Arc90 Lab Experiment. 
 * Website: http://lab.arc90.com/experiments/readability
 * Source:  http://code.google.com/p/arc90labs-readability
 *
 * Copyright (c) 2009 Arc90 Inc
 * Readability is licensed under the Apache License, Version 2.0.
**/
var readability = {
    version:     '1.5.0',
    emailSrc:    'http://lab.arc90.com/experiments/readability/email.php',
    iframeLoads: 0,
    frameHack:   false, /**
                         * The frame hack is to workaround a firefox bug where if you
                         * pull content out of a frame and stick it into the parent element, the scrollbar won't appear.
                         * So we fake a scrollbar in the wrapping div.
                        **/
    bodyCache:  null,   /* Cache the body HTML in case we need to re-use it later */
    flags: 0x1 | 0x2,   /* Start with both flags set. */
    
    /* constants */
    FLAG_STRIP_UNLIKELYS: 0x1,
    FLAG_WEIGHT_CLASSES:  0x2,
    
    /**
     * All of the regular expressions in use within readability.
     * Defined up here so we don't instantiate them repeatedly in loops.
     **/
    regexps: {
        unlikelyCandidatesRe:   /combx|comment|disqus|foot|header|menu|meta|rss|shoutbox|sidebar|sponsor/i,
        okMaybeItsACandidateRe: /and|article|body|column|main/i,
        positiveRe:             /article|body|content|entry|hentry|page|pagination|post|text/i,
        negativeRe:             /combx|comment|contact|foot|footer|footnote|link|media|meta|promo|related|scroll|shoutbox|sponsor|tags|widget/i,
        divToPElementsRe:       /<(a|blockquote|dl|div|img|ol|p|pre|table|ul)/i,
        replaceBrsRe:           /(<br[^>]*>[ \n\r\t]*){2,}/gi,
        replaceFontsRe:         /<(\/?)font[^>]*>/gi,
        trimRe:                 /^\s+|\s+$/g,
        normalizeRe:            /\s{2,}/g,
        killBreaksRe:           /(<br\s*\/?>(\s|&nbsp;?)*){1,}/g,
        videoRe:                /http:\/\/(www\.)?(youtube|vimeo)\.com/i
    },

    /**
     * Runs readability.
     * 
     * Workflow:
     *  1. Prep the document by removing script tags, css, etc.
     *  2. Build readability's DOM tree.
     *  3. Grab the article content from the current dom tree.
     *  4. Replace the current DOM tree with the new one.
     *  5. Read peacefully.
     *
     * @return void
     **/
    init: function() {
        document.body.style.display = "none";
        if(document.body && !readability.bodyCache) {
            readability.bodyCache = document.body.innerHTML; }
        
        readability.prepDocument();

        /* Build readability's DOM tree */
        var overlay        = document.createElement("DIV");
        var innerDiv       = document.createElement("DIV");
        var articleTools   = readability.getArticleTools();
        var articleTitle   = readability.getArticleTitle();
        var articleContent = readability.grabArticle();
        var articleFooter  = readability.getArticleFooter();

        /**
         * If we attempted to strip unlikely candidates on the first run through, and we ended up with no content,
         * that may mean we stripped out the actual content so we couldn't parse it. So re-run init while preserving
         * unlikely candidates to have a better shot at getting our content out properly.
        **/
        if(readability.getInnerText(articleContent, false).length < 250)
        {
            if (readability.flagIsActive(readability.FLAG_STRIP_UNLIKELYS)) {
                readability.removeFlag(readability.FLAG_STRIP_UNLIKELYS);
                document.body.innerHTML = readability.bodyCache;
                return readability.init();
            }
            else if (readability.flagIsActive(readability.FLAG_WEIGHT_CLASSES)) {
                readability.removeFlag(readability.FLAG_WEIGHT_CLASSES);
                document.body.innerHTML = readability.bodyCache;
                return readability.init();              
            }
            else {
                articleContent.innerHTML = "<p>Sorry, readability was unable to parse this page for content. If you feel like it should have been able to, please <a href='http://code.google.com/p/arc90labs-readability/issues/entry'>let us know by submitting an issue.</a></p><p>Also, please note that Readability does not play very nicely with front pages. Readability is intended to work on articles with a sizable chunk of text that you'd like to read comfortably. If you're using Readability on a landing page (like nytimes.com for example), please click into an article first before using Readability.</p>";
            }
        }

        overlay.id              = "readOverlay";
        innerDiv.id             = "readInner";

        /* Apply user-selected styling */
        document.body.className = readStyle;
        if (readStyle == "style-athelas" || readStyle == "style-apertura"){
            overlay.className       = readStyle + " rdbTypekit";
        }
        else {
            overlay.className       = readStyle;
        }
        innerDiv.className      = readMargin + " " + readSize;

        /* Glue the structure of our document together. */
        // articleContent.appendChild( articleFooter  );
              innerDiv.appendChild( articleTitle   );
              innerDiv.appendChild( articleContent );
              innerDiv.appendChild( articleFooter  );
               overlay.appendChild( articleTools   );
               overlay.appendChild( innerDiv       );

        /* Clear the old HTML, insert the new content. */
        document.body.innerHTML = "";
        document.body.insertBefore(overlay, document.body.firstChild);

        if(readability.frameHack)
        {
            var readOverlay = document.getElementById('readOverlay');
            readOverlay.style.height = '100%';
            readOverlay.style.overflow = 'auto';
        }

        /**
         * If someone tries to use Readability on a site's root page, give them a warning about usage.
        **/
        if((window.location.protocol + "//" + window.location.host + "/") == window.location.href)
        {
            articleContent.style.display = "none";
            var rootWarning = document.createElement('p');
                rootWarning.id = "readability-warning";
                rootWarning.innerHTML = "<em>Readability</em> was intended for use on individual articles and not home pages. " +
                    "If you'd like to try rendering this page anyways, <a onClick='javascript:document.getElementById(\"readability-warning\").style.display=\"none\";document.getElementById(\"readability-content\").style.display=\"block\";'>click here</a> to continue.";

            innerDiv.insertBefore( rootWarning, articleContent );
        }
        document.body.style.display = "block";

        window.scrollTo(0, 0);

        /* If we're using the Typekit library, select the font */
        if (readStyle == "style-athelas" || readStyle == "style-apertura") {
            readability.useRdbTypekit();
        }
    },

    /**
     * Get the article tools Element that has buttons like reload, print, email.
     *
     * @return void
     **/
    getArticleTools: function () {
        var articleTools = document.createElement("DIV");

        articleTools.id        = "readTools";
        articleTools.innerHTML = 
            "<a href='#' onclick='return window.location.reload()' title='Reload original page' id='reload-page'>Reload Original Page</a>" +
            "<a href='#' onclick='javascript:window.print();' title='Print page' id='print-page'>Print Page</a>" +
            "<a href='#' onclick='readability.emailBox(); return false;' title='Email page' id='email-page'>Email Page</a>";

        return articleTools;
    },
    
	/**
	 * Get the article title as an H1.
	 *
	 * @return void
	 **/
	getArticleTitle: function () {
		var curTitle = document.title;

		if(curTitle.match(/ [\|\-] /))
		{
			curTitle = document.title.replace(/(.*)[\|\-] .*/gi,'$1');
			
			if(curTitle.split(' ').length < 3) {
				curTitle = document.title.replace(/[^\|\-]*[\|\-](.*)/gi,'$1');
			}
		}
		else if(curTitle.indexOf(': ') !== -1)
		{
			curTitle = document.title.replace(/.*:(.*)/gi, '$1');

			if(curTitle.split(' ').length < 3) {
				curTitle = document.title.replace(/[^:]*[:](.*)/gi,'$1');
			}
		}
		else if(curTitle.length > 150 || curTitle.length < 15)
		{
			var hOnes = document.getElementsByTagName('h1');
			if(hOnes.length == 1)
			{
				curTitle = readability.getInnerText(hOnes[0]);
			}
		}

		curTitle = curTitle.replace( readability.regexps.trimRe, "" );

		if(curTitle.split(' ').length <= 4) {
			curTitle = document.title;
		}
		
		var articleTitle = document.createElement("H1");
		articleTitle.innerHTML = curTitle;
		
		return articleTitle;
	},

    /**
     * Get the footer with the readability mark etc.
     *
     * @return void
     **/
    getArticleFooter: function () {
        var articleFooter = document.createElement("DIV");

		/**
		 * For research purposes, generate an img src that contains the chosen readstyle etc,
		 * so we can generate aggregate stats and change styles based on them in the future
		 **/
        // var statsQueryParams = "?readStyle=" + encodeURIComponent(readStyle) + "&readMargin=" + encodeURIComponent(readMargin) + "&readSize=" + encodeURIComponent(readSize);
		/* TODO: attach this to an image */

        var twitterLink = document.createElement('a');
            twitterLink.setAttribute('href','http://lab.arc90.com/experiments/readability');
            twitterLink.setAttribute('id','footer-twitterLink');
            twitterLink.setAttribute('title','Follow Arc90 on Twitter');
            twitterLink.innerHTML = "Follow us on Twitter &raquo;";

        articleFooter.id = "readFooter";
        articleFooter.innerHTML = 
            "<div id='rdb-footer-left'>" +
                "<a href='http://lab.arc90.com/experiments/readability' id='readability-logo'>Readability &mdash; </a>" +
                "<a href='http://www.arc90.com/' id='arc90-logo'>An Arc90 Laboratory Experiment</a>" +
				"<span id='readability-url'> &mdash; http://lab.arc90.com/experiments/readability</span>" +
                "<a href='http://www.twitter.com/arc90' class='footer-twitterLink'>Follow us on Twitter &raquo;</a>" +
            "</div>" +
            "<div id='rdb-footer-right'>" +
                "<a href='http://www.twitter.com/arc90' class='footer-twitterLink'>Follow us on Twitter &raquo;</a>" +
                "<span class='version'>Readability version " + readability.version + "</span>" +
            "</div>";

        // if (readStyle == ("style-athelas" || "style-apertura")) {
        //     console.log("Using Typekit Footer");
        //     getElementById("rdb-footer-logo").appendChild(twitterLink);
        // }
        // else {
        //     console.log("Using Normal Footer");
        //     articleFooter.getElementById("rdb-footer-right").appendChild(twitterLink);
        // }

        return articleFooter;
    },
    
    /**
     * Prepare the HTML document for readability to scrape it.
     * This includes things like stripping javascript, CSS, and handling terrible markup.
     * 
     * @return void
     **/
    prepDocument: function () {
        /**
         * In some cases a body element can't be found (if the HTML is totally hosed for example)
         * so we create a new body node and append it to the document.
         */
        if(document.body === null)
        {
            var body = document.createElement("body");
            try {
                document.body = body;       
            }
            catch(e) {
                document.documentElement.appendChild(body);
                dbg(e);
            }
        }

        var frames = document.getElementsByTagName('frame');
        if(frames.length > 0)
        {
            var bestFrame = null;
            var bestFrameSize = 0;
            for(var frameIndex = 0; frameIndex < frames.length; frameIndex++)
            {
                var frameSize = frames[frameIndex].offsetWidth + frames[frameIndex].offsetHeight;
                var canAccessFrame = false;
                try {
                    frames[frameIndex].contentWindow.document.body;
                    canAccessFrame = true;
                }
                catch(eFrames) {
                    dbg(eFrames);
                }
                
                if(canAccessFrame && frameSize > bestFrameSize)
                {
                    bestFrame = frames[frameIndex];
                    bestFrameSize = frameSize;
                }
            }

            if(bestFrame)
            {
                var newBody = document.createElement('body');
                newBody.innerHTML = bestFrame.contentWindow.document.body.innerHTML;
                newBody.style.overflow = 'scroll';
                document.body = newBody;
                
                var frameset = document.getElementsByTagName('frameset')[0];
                if(frameset) {
                    frameset.parentNode.removeChild(frameset); }
                    
                readability.frameHack = true;
            }
        }

        /* remove all scripts that are not readability */
        var scripts = document.getElementsByTagName('script');
        for(var i = scripts.length-1; i >= 0; i--)
        {
            if(typeof(scripts[i].src) == "undefined" || (scripts[i].src.indexOf('readability') == -1 && scripts[i].src.indexOf('typekit') == -1))
            {
                scripts[i].parentNode.removeChild(scripts[i]);          
            }
        }

        /* remove all stylesheets */
        for (var k=0;k < document.styleSheets.length; k++) {
            if (document.styleSheets[k].href !== null && document.styleSheets[k].href.lastIndexOf("readability") == -1) {
                document.styleSheets[k].disabled = true;
            }
        }

        /* Remove all style tags in head (not doing this on IE) - TODO: Why not? */
        var styleTags = document.getElementsByTagName("style");
        for (var st=0;st < styleTags.length; st++) {
            if (navigator.appName != "Microsoft Internet Explorer") {
                styleTags[st].textContent = ""; }
        }

        /* Turn all double br's into p's */
        /* Note, this is pretty costly as far as processing goes. Maybe optimize later. */
        document.body.innerHTML = document.body.innerHTML.replace(readability.regexps.replaceBrsRe, '</p><p>').replace(readability.regexps.replaceFontsRe, '<$1span>');
    },

    useRdbTypekit: function () {
        var rdbHead      = document.getElementsByTagName('head')[0];
        var rdbTKScript  = document.createElement('script');
        var rdbTKCode    = null;

        var rdbTKLink    = document.createElement('a');
            rdbTKLink.setAttribute('class','rdbTK-powered');
            rdbTKLink.setAttribute('title','Fonts by Typekit');
            rdbTKLink.innerHTML = "Fonts by <span class='rdbTK'>Typekit</span>";

        if (readStyle == "style-athelas") {
            rdbTKCode = "sxt6vzy";
            dbg("Using Athelas Theme");

            rdbTKLink.setAttribute('href','http://typekit.com/?utm_source=readability&utm_medium=affiliate&utm_campaign=athelas');
            rdbTKLink.setAttribute('id','rdb-athelas');
            document.getElementById("rdb-footer-right").appendChild(rdbTKLink);
        }
        if (readStyle == "style-apertura") {
            rdbTKCode = "bae8ybu";
            dbg("Using Inverse Theme");

            rdbTKLink.setAttribute('href','http://typekit.com/?utm_source=readability&utm_medium=affiliate&utm_campaign=inverse');
            rdbTKLink.setAttribute('id','rdb-inverse');
            document.getElementById("rdb-footer-right").appendChild(rdbTKLink);
        }

        /**
         * Setting new script tag attributes to pull Typekits libraries
        **/
        rdbTKScript.setAttribute('type','text/javascript');
        rdbTKScript.setAttribute('src',"http://use.typekit.com/" + rdbTKCode + ".js");
		rdbTKScript.setAttribute('charset','UTF-8');
        rdbHead.appendChild(rdbTKScript);

        /**
         * In the future, maybe try using the following experimental Callback function?:
         * http://gist.github.com/192350
         * &
         * http://getsatisfaction.com/typekit/topics/support_a_pre_and_post_load_callback_function
        **/
		var typekitLoader = function() {
		    dbg("Looking for Typekit.");
			if(typeof Typekit != "undefined") {
				try {
					dbg("Caught typekit");
					Typekit.load();
					clearInterval(window.typekitInterval);
				} catch(e) {
					dbg("Typekit error: " + e);
				}
			}
		};

		window.typekitInterval = window.setInterval(typekitLoader, 100);
    },

    /**
     * Prepare the article node for display. Clean out any inline styles,
     * iframes, forms, strip extraneous <p> tags, etc.
     *
     * @param Element
     * @return void
     **/
    prepArticle: function (articleContent) {
        readability.cleanStyles(articleContent);
        readability.killBreaks(articleContent);

        /* Clean out junk from the article content */
        readability.clean(articleContent, "form");
        readability.clean(articleContent, "object");
        readability.clean(articleContent, "h1");
        /**
         * If there is only one h2, they are probably using it
         * as a header and not a subheader, so remove it since we already have a header.
        ***/
        if(articleContent.getElementsByTagName('h2').length == 1) {
            readability.clean(articleContent, "h2"); }
        readability.clean(articleContent, "iframe");

        readability.cleanHeaders(articleContent);

        /* Do these last as the previous stuff may have removed junk that will affect these */
        readability.cleanConditionally(articleContent, "table");
        readability.cleanConditionally(articleContent, "ul");
        readability.cleanConditionally(articleContent, "div");

        /* Remove extra paragraphs */
        var articleParagraphs = articleContent.getElementsByTagName('p');
        for(var i = articleParagraphs.length-1; i >= 0; i--)
        {
            var imgCount    = articleParagraphs[i].getElementsByTagName('img').length;
            var embedCount  = articleParagraphs[i].getElementsByTagName('embed').length;
            var objectCount = articleParagraphs[i].getElementsByTagName('object').length;
            
            if(imgCount === 0 && embedCount === 0 && objectCount === 0 && readability.getInnerText(articleParagraphs[i], false) == '')
            {
                articleParagraphs[i].parentNode.removeChild(articleParagraphs[i]);
            }
        }

        try {
            articleContent.innerHTML = articleContent.innerHTML.replace(/<br[^>]*>\s*<p/gi, '<p');      
        }
        catch (e) {
            dbg("Cleaning innerHTML of breaks failed. This is an IE strict-block-elements bug. Ignoring.: " + e);
        }
    },
    
    /**
     * Initialize a node with the readability object. Also checks the
     * className/id for special names to add to its score.
     *
     * @param Element
     * @return void
    **/
    initializeNode: function (node) {
        node.readability = {"contentScore": 0};         

        switch(node.tagName) {
            case 'DIV':
                node.readability.contentScore += 5;
                break;

            case 'PRE':
            case 'TD':
            case 'BLOCKQUOTE':
                node.readability.contentScore += 3;
                break;
                
            case 'ADDRESS':
            case 'OL':
            case 'UL':
            case 'DL':
            case 'DD':
            case 'DT':
            case 'LI':
            case 'FORM':
                node.readability.contentScore -= 3;
                break;

            case 'H1':
            case 'H2':
            case 'H3':
            case 'H4':
            case 'H5':
            case 'H6':
            case 'TH':
                node.readability.contentScore -= 5;
                break;
        }

        node.readability.contentScore += readability.getClassWeight(node);
    },
    
    /***
     * grabArticle - Using a variety of metrics (content score, classname, element types), find the content that is
     *               most likely to be the stuff a user wants to read. Then return it wrapped up in a div.
     *
     * @return Element
    **/
    grabArticle: function () {
        var stripUnlikelyCandidates = readability.flagIsActive(readability.FLAG_STRIP_UNLIKELYS);

        /**
         * First, node prepping. Trash nodes that look cruddy (like ones with the class name "comment", etc), and turn divs
         * into P tags where they have been used inappropriately (as in, where they contain no other block level elements.)
         *
         * Note: Assignment from index for performance. See http://www.peachpit.com/articles/article.aspx?p=31567&seqNum=5
         * TODO: Shouldn't this be a reverse traversal?
        **/
        var node = null;
		var nodesToScore = [];
        for(var nodeIndex = 0; (node = document.getElementsByTagName('*')[nodeIndex]); nodeIndex++)
        {
            /* Remove unlikely candidates */
            if (stripUnlikelyCandidates) {
                var unlikelyMatchString = node.className + node.id;
                if (unlikelyMatchString.search(readability.regexps.unlikelyCandidatesRe) !== -1 &&
                    unlikelyMatchString.search(readability.regexps.okMaybeItsACandidateRe) == -1 &&
                    node.tagName !== "BODY")
                {
                    dbg("Removing unlikely candidate - " + unlikelyMatchString);
                    node.parentNode.removeChild(node);
                    nodeIndex--;
                    continue;
                }               
            }

			if (node.tagName === "P" || node.tagName === "TD") {
				nodesToScore[nodesToScore.length] = node;
			}

            /* Turn all divs that don't have children block level elements into p's */
            if (node.tagName === "DIV") {
                if (node.innerHTML.search(readability.regexps.divToPElementsRe) === -1) {
                    dbg("Altering div to p");
                    var newNode = document.createElement('p');
                    try {
                        newNode.innerHTML = node.innerHTML;             
                        node.parentNode.replaceChild(newNode, node);
                        nodeIndex--;
                    }
                    catch(e) {
                        dbg("Could not alter div to p, probably an IE restriction, reverting back to div.: " + e);
                    }
                }
                else
                {
                    /* EXPERIMENTAL */
                    for(var i = 0, il = node.childNodes.length; i < il; i++) {
                        var childNode = node.childNodes[i];
                        if(childNode.nodeType == 3) { // Node.TEXT_NODE
                            dbg("replacing text node with a p tag with the same content.");
                            var p = document.createElement('p');
                            p.innerHTML = childNode.nodeValue;
                            p.style.display = 'inline';
                            p.className = 'readability-styled';
                            childNode.parentNode.replaceChild(p, childNode);
                        }
                    }
                }
            } 
        }

        /**
         * Loop through all paragraphs, and assign a score to them based on how content-y they look.
         * Then add their score to their parent node.
         *
         * A score is determined by things like number of commas, class names, etc. Maybe eventually link density.
        **/
		var candidates = [];
        for (var pt=0; pt < nodesToScore.length; pt++) {
            var parentNode      = nodesToScore[pt].parentNode;
            var grandParentNode = parentNode.parentNode;
            var innerText       = readability.getInnerText(nodesToScore[pt]);

            /* If this paragraph is less than 25 characters, don't even count it. */
            if(innerText.length < 25) {
                continue; }

            /* Initialize readability data for the parent. */
            if(typeof parentNode.readability == 'undefined')
            {
                readability.initializeNode(parentNode);
                candidates.push(parentNode);
            }

            /* Initialize readability data for the grandparent. */
            if(typeof grandParentNode.readability == 'undefined')
            {
                readability.initializeNode(grandParentNode);
                candidates.push(grandParentNode);
            }

            var contentScore = 0;

            /* Add a point for the paragraph itself as a base. */
            contentScore++;

            /* Add points for any commas within this paragraph */
            contentScore += innerText.split(',').length;
            
            /* For every 100 characters in this paragraph, add another point. Up to 3 points. */
            contentScore += Math.min(Math.floor(innerText.length / 100), 3);
            
            /* Add the score to the parent. The grandparent gets half. */
            parentNode.readability.contentScore += contentScore;
            grandParentNode.readability.contentScore += contentScore/2;
        }

        /**
         * After we've calculated scores, loop through all of the possible candidate nodes we found
         * and find the one with the highest score.
        **/
        var topCandidate = null;
        for(var c=0, cl=candidates.length; c < cl; c++)
        {
            /**
             * Scale the final candidates score based on link density. Good content should have a
             * relatively small link density (5% or less) and be mostly unaffected by this operation.
            **/
            candidates[c].readability.contentScore = candidates[c].readability.contentScore * (1-readability.getLinkDensity(candidates[c]));

            dbg('Candidate: ' + candidates[c] + " (" + candidates[c].className + ":" + candidates[c].id + ") with score " + candidates[c].readability.contentScore);

            if(!topCandidate || candidates[c].readability.contentScore > topCandidate.readability.contentScore) {
                topCandidate = candidates[c]; }
        }

        /**
         * If we still have no top candidate, just use the body as a last resort.
         * We also have to copy the body node so it is something we can modify.
         **/
        if (topCandidate === null || topCandidate.tagName == "BODY")
        {
            topCandidate = document.createElement("DIV");
            topCandidate.innerHTML = document.body.innerHTML;
            document.body.innerHTML = "";
            document.body.appendChild(topCandidate);
            readability.initializeNode(topCandidate);
        }


        /**
         * Now that we have the top candidate, look through its siblings for content that might also be related.
         * Things like preambles, content split by ads that we removed, etc.
        **/
        var articleContent        = document.createElement("DIV");
            articleContent.id     = "readability-content";
        var siblingScoreThreshold = Math.max(10, topCandidate.readability.contentScore * 0.2);
        var siblingNodes          = topCandidate.parentNode.childNodes;
        for(var s=0, sl=siblingNodes.length; s < sl; s++)
        {
            var siblingNode = siblingNodes[s];
            var append      = false;

            dbg("Looking at sibling node: " + siblingNode + " (" + siblingNode.className + ":" + siblingNode.id + ")" + ((typeof siblingNode.readability != 'undefined') ? (" with score " + siblingNode.readability.contentScore) : ''));
            dbg("Sibling has score " + (siblingNode.readability ? siblingNode.readability.contentScore : 'Unknown'));

            if(siblingNode === topCandidate)
            {
                append = true;
            }
            
            if(typeof siblingNode.readability != 'undefined' && siblingNode.readability.contentScore >= siblingScoreThreshold)
            {
                append = true;
            }
            
            if(siblingNode.nodeName == "P") {
                var linkDensity = readability.getLinkDensity(siblingNode);
                var nodeContent = readability.getInnerText(siblingNode);
                var nodeLength  = nodeContent.length;
                
                if(nodeLength > 80 && linkDensity < 0.25)
                {
                    append = true;
                }
                else if(nodeLength < 80 && linkDensity === 0 && nodeContent.search(/\.( |$)/) !== -1)
                {
                    append = true;
                }
            }

            if(append)
            {
                dbg("Appending node: " + siblingNode);

				var nodeToAppend = null;
				if(siblingNode.nodeName != "DIV" && siblingNode.nodeName != "P") {
					/* We have a node that isn't a common block level element, like a form or td tag. Turn it into a div so it doesn't get filtered out later by accident. */
					
                    dbg("Altering siblingNode of " + siblingNode.nodeName + ' to div.');
                    nodeToAppend = document.createElement('div');
                    try {
						nodeToAppend.id = siblingNode.id;
                        nodeToAppend.innerHTML = siblingNode.innerHTML;
                    }
                    catch(e)
                    {
                        dbg("Could not alter siblingNode to div, probably an IE restriction, reverting back to original.");
						nodeToAppend = siblingNode;
		                s--;
		                sl--;
                    }
				} else {
					nodeToAppend = siblingNode;
	                s--;
	                sl--;
				}
				
				/* To ensure a node does not interfere with readability styles, remove its classnames */
				nodeToAppend.className = "";

                /* Append sibling and subtract from our list because it removes the node when you append to another node */
                articleContent.appendChild(nodeToAppend);
            }
        }

        /**
         * So we have all of the content that we need. Now we clean it up for presentation.
        **/
        readability.prepArticle(articleContent);
        
        return articleContent;
    },
    
    /**
     * Get the inner text of a node - cross browser compatibly.
     * This also strips out any excess whitespace to be found.
     *
     * @param Element
     * @return string
    **/
    getInnerText: function (e, normalizeSpaces) {
        var textContent    = "";

        normalizeSpaces = (typeof normalizeSpaces == 'undefined') ? true : normalizeSpaces;

        if (navigator.appName == "Microsoft Internet Explorer") {
            textContent = e.innerText.replace( readability.regexps.trimRe, "" ); }
        else {
            textContent = e.textContent.replace( readability.regexps.trimRe, "" ); }

        if(normalizeSpaces) {
            return textContent.replace( readability.regexps.normalizeRe, " "); }
        else {
            return textContent; }
    },

    /**
     * Get the number of times a string s appears in the node e.
     *
     * @param Element
     * @param string - what to split on. Default is ","
     * @return number (integer)
    **/
    getCharCount: function (e,s) {
        s = s || ",";
        return readability.getInnerText(e).split(s).length-1;
    },

    /**
     * Remove the style attribute on every e and under.
     * TODO: Test if getElementsByTagName(*) is faster.
     *
     * @param Element
     * @return void
    **/
    cleanStyles: function (e) {
        e = e || document;
        var cur = e.firstChild;

        if(!e) {
            return; }

        // Remove any root styles, if we're able.
        if(typeof e.removeAttribute == 'function' && e.className != 'readability-styled') {
            e.removeAttribute('style'); }

        // Go until there are no more child nodes
        while ( cur !== null ) {
            if ( cur.nodeType == 1 ) {
                // Remove style attribute(s) :
                if(cur.className != "readability-styled") {
                    cur.removeAttribute("style");                   
                }
                readability.cleanStyles( cur );
            }
            cur = cur.nextSibling;
        }           
    },
    
    /**
     * Get the density of links as a percentage of the content
     * This is the amount of text that is inside a link divided by the total text in the node.
     * 
     * @param Element
     * @return number (float)
    **/
    getLinkDensity: function (e) {
        var links      = e.getElementsByTagName("a");
        var textLength = readability.getInnerText(e).length;
        var linkLength = 0;
        for(var i=0, il=links.length; i<il;i++)
        {
            linkLength += readability.getInnerText(links[i]).length;
        }       

        return linkLength / textLength;
    },
    
    /**
     * Get an elements class/id weight. Uses regular expressions to tell if this 
     * element looks good or bad.
     *
     * @param Element
     * @return number (Integer)
    **/
    getClassWeight: function (e) {
        if(!readability.flagIsActive(readability.FLAG_WEIGHT_CLASSES)) {
            return 0;
        }

        var weight = 0;

        /* Look for a special classname */
        if (e.className != "")
        {
            if(e.className.search(readability.regexps.negativeRe) !== -1) {
                weight -= 25; }

            if(e.className.search(readability.regexps.positiveRe) !== -1) {
                weight += 25; }
        }

        /* Look for a special ID */
        if (typeof(e.id) == 'string' && e.id != "")
        {
            if(e.id.search(readability.regexps.negativeRe) !== -1) {
                weight -= 25; }

            if(e.id.search(readability.regexps.positiveRe) !== -1) {
                weight += 25; }
        }

        return weight;
    },
    
    /**
     * Remove extraneous break tags from a node.
     *
     * @param Element
     * @return void
     **/
    killBreaks: function (e) {
        try {
            e.innerHTML = e.innerHTML.replace(readability.regexps.killBreaksRe,'<br />');       
        }
        catch (eBreaks) {
            dbg("KillBreaks failed - this is an IE bug. Ignoring.: " + eBreaks);
        }
    },

    /**
     * Clean a node of all elements of type "tag".
     * (Unless it's a youtube/vimeo video. People love movies.)
     *
     * @param Element
     * @param string tag to clean
     * @return void
     **/
    clean: function (e, tag) {
        var targetList = e.getElementsByTagName( tag );
        var isEmbed    = (tag == 'object' || tag == 'embed');
        
        for (var y=targetList.length-1; y >= 0; y--) {
            /* Allow youtube and vimeo videos through as people usually want to see those. */
            if(isEmbed) {
                var attributeValues = "";
                for (var i=0, il=targetList[y].attributes.length; i < il; i++) {
                    attributeValues += targetList[y].attributes[i].value + '|';
                }
                
                /* First, check the elements attributes to see if any of them contain youtube or vimeo */
                if (attributeValues.search(readability.regexps.videoRe) !== -1) {
                    continue;
                }

                /* Then check the elements inside this element for the same. */
                if (targetList[y].innerHTML.search(readability.regexps.videoRe) !== -1) {
                    continue;
                }
                
            }

            targetList[y].parentNode.removeChild(targetList[y]);
        }
    },
    
    /**
     * Clean an element of all tags of type "tag" if they look fishy.
     * "Fishy" is an algorithm based on content length, classnames, link density, number of images & embeds, etc.
     *
     * @return void
     **/
    cleanConditionally: function (e, tag) {
        var tagsList      = e.getElementsByTagName(tag);
        var curTagsLength = tagsList.length;

        /**
         * Gather counts for other typical elements embedded within.
         * Traverse backwards so we can remove nodes at the same time without effecting the traversal.
         *
         * TODO: Consider taking into account original contentScore here.
        **/
        for (var i=curTagsLength-1; i >= 0; i--) {
            var weight = readability.getClassWeight(tagsList[i]);
            var contentScore = (typeof tagsList[i].readability != 'undefined') ? tagsList[i].readability.contentScore : 0;
            
            dbg("Cleaning Conditionally " + tagsList[i] + " (" + tagsList[i].className + ":" + tagsList[i].id + ")" + ((typeof tagsList[i].readability != 'undefined') ? (" with score " + tagsList[i].readability.contentScore) : ''));

            if(weight+contentScore < 0)
            {
                tagsList[i].parentNode.removeChild(tagsList[i]);
            }
            else if ( readability.getCharCount(tagsList[i],',') < 10) {
                /**
                 * If there are not very many commas, and the number of
                 * non-paragraph elements is more than paragraphs or other ominous signs, remove the element.
                **/
                var p      = tagsList[i].getElementsByTagName("p").length;
                var img    = tagsList[i].getElementsByTagName("img").length;
                var li     = tagsList[i].getElementsByTagName("li").length-100;
                var input  = tagsList[i].getElementsByTagName("input").length;

                var embedCount = 0;
                var embeds     = tagsList[i].getElementsByTagName("embed");
                for(var ei=0,il=embeds.length; ei < il; ei++) {
                    if (embeds[ei].src.search(readability.regexps.videoRe) == -1) {
                      embedCount++; 
                    }
                }

                var linkDensity   = readability.getLinkDensity(tagsList[i]);
                var contentLength = readability.getInnerText(tagsList[i]).length;
                var toRemove      = false;

                if ( img > p ) {
                    toRemove = true;
                } else if(li > p && tag != "ul" && tag != "ol") {
                    toRemove = true;
                } else if( input > Math.floor(p/3) ) {
                    toRemove = true; 
                } else if(contentLength < 25 && (img === 0 || img > 2) ) {
                    toRemove = true;
                } else if(weight < 25 && linkDensity > 0.2) {
                    toRemove = true;
                } else if(weight >= 25 && linkDensity > 0.5) {
                    toRemove = true;
                } else if((embedCount == 1 && contentLength < 75) || embedCount > 1) {
                    toRemove = true;
                }

                if(toRemove) {
                    tagsList[i].parentNode.removeChild(tagsList[i]);
                }
            }
        }
    },

    /**
     * Clean out spurious headers from an Element. Checks things like classnames and link density.
     *
     * @param Element
     * @return void
    **/
    cleanHeaders: function (e) {
        for (var headerIndex = 1; headerIndex < 7; headerIndex++) {
            var headers = e.getElementsByTagName('h' + headerIndex);
            for (var i=headers.length-1; i >=0; i--) {
                if (readability.getClassWeight(headers[i]) < 0 || readability.getLinkDensity(headers[i]) > 0.33) {
                    headers[i].parentNode.removeChild(headers[i]);
                }
            }
        }
    },
    
    /**
     * Show the email popup.
     *
     * @return void
     **/
    emailBox: function () {
        var emailContainerExists = document.getElementById('email-container');
        if(null !== emailContainerExists)
        {
            return;
        }

        var emailContainer = document.createElement('div');
        emailContainer.setAttribute('id', 'email-container');
        emailContainer.innerHTML = '<iframe src="'+readability.emailSrc + '?pageUrl='+escape(window.location)+'&pageTitle='+escape(document.title)+'" scrolling="no" onload="readability.removeFrame()" style="width:500px; height: 490px; border: 0;"></iframe>';

        document.body.appendChild(emailContainer);          
    },
    
    /**
     * Close the email popup. This is a hacktackular way to check if we're in a "close loop".
     * Since we don't have crossdomain access to the frame, we can only know when it has
     * loaded again. If it's loaded over 3 times, we know to close the frame.
     *
     * @return void
     **/
    removeFrame: function () {
        readability.iframeLoads++;
        if (readability.iframeLoads > 3)
        {
            var emailContainer = document.getElementById('email-container');
            if (null !== emailContainer) {
                emailContainer.parentNode.removeChild(emailContainer);
            }

            readability.iframeLoads = 0;
        }           
    },
    
    htmlspecialchars: function (s) {
        if (typeof(s) == "string") {
            s = s.replace(/&/g, "&amp;");
            s = s.replace(/"/g, "&quot;");
            s = s.replace(/'/g, "&#039;");
            s = s.replace(/</g, "&lt;");
            s = s.replace(/>/g, "&gt;");
        }
    
        return s;
    },

    flagIsActive: function(flag) {
        return (readability.flags & flag) > 0;
    },
    
    addFlag: function(flag) {
        readability.flags = readability.flags | flag;
    },
    
    removeFlag: function(flag) {
        readability.flags = readability.flags & ~flag;
    }
    
};

readability.init();
