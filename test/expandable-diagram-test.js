var tape = require("tape"),
    jsdom = require('jsdom'),
    select = require('d3-selection').select,
    transition = require('d3-transition'),
    diagram = require("../");

tape("expandableSankeyDiagram() can be called", function(test) {
  var dom = new jsdom.JSDOM();
  global.document = dom.window.document;
  var svg = select('body').append('svg').datum({nodes: [], links: []});
  test.equal(diagram.expandableSankeyDiagram()(svg), undefined);
  test.end();
});
