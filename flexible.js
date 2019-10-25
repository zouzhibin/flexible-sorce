// https://segmentfault.com/a/1190000009017413
/**我们需要将windows对象注入，然后在看看windows下是否已经存在lib（即是否已经有
使用过flexible）了，注入完之后，我们依次获得doc，docEl，metaEl，flexibleEl，其中metaEl
是为了判断我们是否已经有预设好的viewport，flexibleEl则是判断我们已经手动设置好dpr来避免
flexible库动态设置dpr**/
;(function(win, lib) {
    // 获取全局的document
    var doc = win.document;
    // 获取文档的文档元素, 返回为一个元素对象.
    var docEl = doc.documentElement;
    // 
    var metaEl = doc.querySelector('meta[name="viewport"]');
    var flexibleEl = doc.querySelector('meta[name="flexible"]');
    var dpr = 0;
    var scale = 0;
    var tid;
    var flexible = lib.flexible || (lib.flexible = {});

    /**
     * 如果metaEl存在的话，意味着页面上存在形如
     * <meta name="viewport" content="initial-scale=1">的标签，
     * 此时我们已经明确了我们需要的缩放，不再需要flexible的介入，缩放值scale直接
     * 使用预设的initial-scale，通过我们预设的的缩放，我们的layout viewport将
     * 会是 ideal viewport/scale，如果我们的initual-scale为1的话
     */
    if (metaEl) {
        console.warn('将根据已有的meta标签来设置缩放比例');
        var match = metaEl.getAttribute('content').match(/initial\-scale=([\d\.]+)/);
        if (match) {
            scale = parseFloat(match[1]);
            dpr = parseInt(1 / scale);
        }
     /**
       *如果我们没有设置初始的viewport但是有
       *<meta name="flexible" content="initial-dpr=2" />
        这样的flexible自身的预设
        那么我们将会有预设的dpr，此时flexible将根据我们预设的dpr
        通过scale=1/dpr的方式来计算出我们的缩放，进而影响layout viewport
        的大小 
      * 
      **/   
    } else if (flexibleEl) {
        var content = flexibleEl.getAttribute('content');
        if (content) {
            var initialDpr = content.match(/initial\-dpr=([\d\.]+)/);
            var maximumDpr = content.match(/maximum\-dpr=([\d\.]+)/);
            if (initialDpr) {
                dpr = parseFloat(initialDpr[1]);
                scale = parseFloat((1 / dpr).toFixed(2));
            }
            if (maximumDpr) {
                dpr = parseFloat(maximumDpr[1]);
                scale = parseFloat((1 / dpr).toFixed(2));
            }
        }
    }
    /**
     * 如果我们既没有通过<meta name="flexible" content="initial-dpr=2" />这种方式预设dpr，
    也没有通过<meta name="viewport" content="initial-scale=1">的方式预设缩放，
    此时flexible开始根据
    设备的dpr来动态计算缩放。对于非苹果设备，flexible设置dpr为1，对于苹果设备，
    iPhone3以下非retina屏，dpr为1
    iPhone4-iPhone6为retina屏，dpr为2，iPhone6Plus为retina HD屏，
    dpr为3，由于flexible是一个专注于移动端
    的解决方案，所以平板（包括iPad）或者桌面端的dpr都为1
     * 
     */
    if (!dpr && !scale) {
        var isAndroid = win.navigator.appVersion.match(/android/gi);
        var isIPhone = win.navigator.appVersion.match(/iphone/gi);
        var devicePixelRatio = win.devicePixelRatio;
        if (isIPhone) {
            // iOS下，对于2和3的屏，用2倍的方案，其余的用1倍方案
            if (devicePixelRatio >= 3 && (!dpr || dpr >= 3)) {
                dpr = 3;
            } else if (devicePixelRatio >= 2 && (!dpr || dpr >= 2)){
                dpr = 2;
            } else {
                dpr = 1;
            }
        } else {
            // 其他设备下，仍旧使用1倍的方案
            dpr = 1;
        }
        scale = 1 / dpr;
    }
    // 计算完缩放后，将获取的dpr值设置到根元素上，这样我们就可以通过以下方式：
    docEl.setAttribute('data-dpr', dpr);

    /**
     * 同时当不存在metaEl时，flexible动态生成一条
     * <meta name="viewport" content="initial-scale=${scale},maximum-scale=${scale},minimum-scale=${scale},user-scalable=no">
        的标签，如果<html>下存在元素（如<head>等元素）那么，将meta标签插入，
        如果没有，就将meta标签用一个div包装，然后
        通过document.write写入到文档中
     * 
     * */ 
    if (!metaEl) {
        metaEl = doc.createElement('meta');
        metaEl.setAttribute('name', 'viewport');
        metaEl.setAttribute('content', 'initial-scale=' + scale + ', maximum-scale=' + scale + ', minimum-scale=' + scale + ', user-scalable=no');
        if (docEl.firstElementChild) {
            docEl.firstElementChild.appendChild(metaEl);
        } else {
            var wrap = doc.createElement('div');
            wrap.appendChild(metaEl);
            doc.write(wrap.innerHTML);
        }
    }
    /***
     * 缩放和dpr都设置好了，下一步我们要设置根元素的font-size了，这样我们可以通过rem的方式
        适配不同屏幕。首先我们需要通过docEl.getBoundingClientRect().width获得layout viewport的宽度，
        然后将layout viewport宽度分为10份，1份为1rem。至于设置540px，
        是为了让在ipad横屏这种情况下浏览页面，不至于因为拉伸适配后体验太差。当然这还是有一点点问题的
        因为这样10rem将不会是ipad的满屏了。当然这是移动端解决方案，并没有考虑平板和桌面端
     * 
     */
    function refreshRem(){
        var width = docEl.getBoundingClientRect().width;
        if (width / dpr > 540) {
            width = 540 * dpr;
        }
        var rem = width / 10;
        docEl.style.fontSize = rem + 'px';
        flexible.rem = win.rem = rem;
    }
    // 接着当窗口发生变化或者页面重新从缓存中载入时，我们都要重新设置尺寸
    // 通过setTimeOut函数，进行函数节流，监听resize和pageshow事件，执行refreshRem(）函数
    win.addEventListener('resize', function() {
        clearTimeout(tid);
        tid = setTimeout(refreshRem, 300);
    }, false);
    //  onpageshow 事件在每次加载页面时触发，即 onload 事件在页面从浏览器缓存中读取时不触发。
    win.addEventListener('pageshow', function(e) {
        // persisted 如果页面从浏览器的缓存中读取该属性返回 ture，否则返回 false 
        if (e.persisted) {
            clearTimeout(tid);
            tid = setTimeout(refreshRem, 300);
        }
    }, false);

    // body上设置12 * dpr的font-size值，为了重置页面中的字体默认值，
    // 不然没有设置font-size的元素会继承html上的font-size，变得很大。
    if (doc.readyState === 'complete') {
        doc.body.style.fontSize = 12 * dpr + 'px';
    } else {
        doc.addEventListener('DOMContentLoaded', function(e) {
            doc.body.style.fontSize = 12 * dpr + 'px';
        }, false);
    }


    refreshRem();
    // flexible提供了两个工具函数px2rem和rem2px，可以动态进行设置rem
    flexible.dpr = win.dpr = dpr;
    flexible.refreshRem = refreshRem;
    flexible.rem2px = function(d) {
        var val = parseFloat(d) * this.rem;
        if (typeof d === 'string' && d.match(/rem$/)) {
            val += 'px';
        }
        return val;
    }
    flexible.px2rem = function(d) {
        var val = parseFloat(d) / this.rem;
        if (typeof d === 'string' && d.match(/px$/)) {
            val += 'rem';
        }
        return val;
    }

})(window, window['lib'] || (window['lib'] = {}));
