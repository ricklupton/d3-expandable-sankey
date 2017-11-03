# d3-expandable-sankey

A Sankey diagram to show multiple levels of detail -- nodes expand when you
click on them. Based on `d3-sankey-diagram`.

## Installing

If you use NPM, `npm install d3-expandable-sankey`. Otherwise, download the
[latest
release](https://github.com/ricklupton/d3-expandable-sankey/releases/latest).

## API Reference

<a href="#scale" name="scale">#</a> diagram.<b>scale</b>[(<i>scale</i>])

See
[d3.sankeyDiagram#scale](https://github.com/ricklupton/d3-sankey-diagram/#layout-scale).

<a name="on" href="#on">#</a> diagram.<b>on</b>(<i>type</i>[, <i>listener</i>])

Adds or removes an event *listener* for the specified *type*. The only supported
*type* string is `"clickNode"`. The *listener* is invoked with the context as
the element and one argument, the corresponding data.

If *listener* is not specified, returns the currently-assigned listener for the
specified *type*, if any. 
