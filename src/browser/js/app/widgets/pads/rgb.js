var Pad = require('./pad'),
    Xy = require('./xy'),
    Fader = require('./_fake_fader'),
    {clip, hsbToRgb, rgbToHsb} = require('../utils'),
    Input = require('../inputs/input')

var faderDefaults = Fader.defaults(),
    xyDefaults = Xy.defaults()

module.exports = class Rgb extends Pad {

    static defaults() {

        return {
            type:'rgb',
            id:'auto',
            linkId:'',

            _geometry:'geometry',

            left:'auto',
            top:'auto',
            width:'auto',
            height:'auto',

            _style:'style',

            label:'auto',
            css:'',

            _rgb:'rgb',

            input: true,
            snap:false,
            spring:false,
            range: {min:0,max:255},

            _value: 'value',
            default: '',
            value: '',

            _osc:'osc',

            precision:0,
            address:'auto',
            preArgs:[],
            split:false,
            target:[],
            bypass:false
        }

    }

    constructor(options) {

        options.props.pointSize = 10

        super(options)

        this.split = this.getProp('split')?
            typeof this.getProp('split') == 'object' && this.getProp('split').length == 3 ?
                this.getProp('split')
                : [this.getProp('address') + '/r', this.getProp('address') + '/g', this.getProp('address') + '/b']
            : false

        this.hueWrapper = this.widget.appendChild(DOM.create('<div class="hue-wrapper"></div>'))

        this.hue = new Fader({props:{
            ...faderDefaults,
            id:'h',
            compact:true,
            pips:false,
            horizontal:true,
            snap:this.getProp('snap'),
            range:{min:0,max:360},
            input:false,
            precision:2
        }, cancelDraw: false, parent: this})
        this.hue.margin = this.pointSize
        this.hue.sendValue = ()=>{}
        this.hueWrapper.appendChild(this.hue.widget)

        this.pad = new Xy({props:{
            ...xyDefaults,
            snap:this.getProp('snap'),
            spring:this.getProp('spring'),
            rangeX:{min:0,max:100},
            rangeY:{min:0,max:100},
            precision:2,
            pointSize: this.getProp('pointSize'),
            pips: false,
            input:false
        }, parent: this})
        this.pad.sendValue = ()=>{}
        this.wrapper.appendChild(this.pad.widget)


        this.value = []
        this.hsb = {h:0,s:0,b:0}

        this.hue.on('change',(e)=>{
            e.stopPropagation = true
            this.dragHandle(true)
        })

        this.pad.on('change',(e)=>{
            e.stopPropagation = true
            this.dragHandle()
        })

        if (this.getProp('input')) {

            this.input = new Input({
                props:{...Input.defaults(), precision:this.getProp('precision'), unit:this.getProp('unit')},
                parent:this, parentNode:this.widget
            })
            this.widget.appendChild(this.input.widget)
            this.input.on('change', (e)=>{
                e.stopPropagation = true
                this.setValue(this.input.getValue(), {sync:true, send:true})
                this.showValue()
            })

        }

        this.setValue([this.getProp('range').min, this.getProp('range').min, this.getProp('range').min])

    }

    dragHandle(hue) {
        var h = this.hue.value,
            s = this.pad.value[0],
            b = this.pad.value[1]

        if (h != this.hsb.h ||s != this.hsb.s || b != this.hsb.b) {

            this.hsb.h = this.hue.value
            this.hsb.s = this.pad.value[0]
            this.hsb.b = this.pad.value[1]

            this.update({nohue:!hue})

            var rgb = hsbToRgb(this.hsb),
                {min, max} = this.getProp('range')

            if (min !== 0 || max !== 255) {
                for (var k in rgb) {
                    rgb[k] = min + max * rgb[k] / 255
                }
            }

            if (rgb.r != this.value[0] || rgb.g != this.value[1] || rgb.b != this.value[2]) {
                this.setValue([rgb.r, rgb.g, rgb.b],{send:true,sync:true,dragged:true,nohue:!hue})
            }
        }

    }

    setValue(v, options={}) {

        if (!v || !v.length || v.length!=3) return
        if (this.touched && !options.dragged) return this.setValueTouchedQueue = [v, options]

        for (let i in [0,1,2]) {
            v[i] = clip(v[i],[this.getProp('range').min, this.getProp('range').max])
        }

        var rgb = {r:v[0],g:v[1],b:v[2]},
            {min, max} = this.getProp('range')

        if (min !== 0 || max !== 255) {
            for (var k in rgb) {
                rgb[k] = (rgb[k] - min ) * 255 / max
            }
        }

        var hsb = rgbToHsb(rgb)

        if (!options.dragged) {
            this.pad.setValue([hsb.s, hsb.b], {sync: false, send:false, dragged:false})
        }

        this.hsb = hsb
        this.value = v

        if (options.send) this.sendValue()
        if (options.sync) this.changed(options)

        this.update({dragged:options.dragged, nohue:options.nohue || (v[0]==v[1]&&v[1]==v[2])})

    }

    update(options={}) {

        if (!options.nohue && !options.dragged) {
            var hue = hsbToRgb({h:this.hsb.h,s:100,b:100}),
                hueStr = `rgb(${Math.round(hue.r)},${Math.round(hue.g)},${Math.round(hue.b)})`
            this.canvas.setAttribute('style',`background-color:${hueStr}`)
            this.hue.setValue(this.hsb.h, {sync: false, send:false, dragged:false})
        }


        this.showValue()

    }

    draw() {}

    showValue() {

        if (this.getProp('input')) this.input.setValue(this.value)

    }

    onPropChanged(propName, options, oldPropValue) {

        if (super.onPropChanged(...arguments)) return true

        switch (propName) {

            case 'color':
                for (var w of [this.hue, this.pad]) {
                    w.onPropChanged('color')
                }
                if (this.input) this.input.onPropChanged('color')
                return

        }

    }

    onRemove() {
        this.hue.onRemove()
        this.pad.onRemove()
        if (this.input) this.input.onRemove()
        super.onRemove()
    }

}
