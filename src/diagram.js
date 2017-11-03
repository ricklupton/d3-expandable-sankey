import { select } from 'd3-selection';
import { interpolate } from 'd3-interpolate';
import { format } from 'd3-format';
import { timeout } from 'd3-timer';
import { sankey, sankeyLink, sankeyNode } from 'd3-sankey-diagram';
import { linksAccessor } from './data';

var numberFormat0 = format('.1f');

function numberFormat(x) {
  return numberFormat0(x / 1e9) + ' Gt';
}

var nodeWidth = 60;
var SCALE = 8e-9;

export default function expandableSankey(selection) {
  selection.each(function(data) {
    data.nodes.forEach(function(d) {
      d.subdiv = {};
      var y = 0;
      d.subdivisions.forEach(function(sub, i) {
        sub.node = d;
        sub.dy = SCALE * sub.value;
        sub.y = y;
        y += sub.dy;
        sub.index = i;
        d.subdiv[sub.id] = d.subdiv['in-' + sub.id] = d.subdiv['out-' + sub.id] = sub;
      });
    });

    var expanded = {};

    // Select the svg element, if it exists.
    var svg = select(this); //.selectAll("svg"); //.data([data]);

    // Otherwise, create the skeletal chart.
    // var gEnter = svg.enter().append("svg");
    // gEnter.append('g').attr('class', 'links');
    // gEnter.append('g').attr('class', 'nodes');
    svg.append('g').attr('class', 'links');
    svg.append('g').attr('class', 'nodes');

    var layout = sankey()
        .links(linksAccessor(expanded))
        .linkValue(function (d) { return d.data.value; })
        .nodePosition(function(d) { return [parseInt(d.geometry.x, 10), d.geometry.y]; })
        .nodeWidth(nodeWidth)
        .sortPorts(function(a, b) { return portOrder(a) - portOrder(b); })
        .scale(SCALE)
        .ordering([]);

    var linkPath = sankeyLink()
        .minWidth(function(d) { return 0.1; });

    var snode = sankeyNode()
        .nodeVisible(function(d) { return !d.style.hidden; })
        .nodeTitle(function(d) {
          var t = d.title + '  ' + numberFormat0(d.value / 1e9);
          return d.subdivisions.length && d.subdivisions[0].label ? t.replace('\n', ' ') : t;
        });

    var hover = false;
    var hoverEnabled = true;

    var graph;
    console.log('READY', data);
    relayoutAndRender();

    function relayoutAndRender(skipSubs) {
      graph = layout(data);
      renderLinks(graph.links);
      renderNodes(graph.nodes, skipSubs);
    }

    function targetSub(link) {
      return link.targetPort.node.subdiv[link.targetPort.id] || {};
    }

    function sourceSub(link) {
      return link.sourcePort.node.subdiv[link.sourcePort.id] || {};
    }

    function linkColour(d) {
      return subColor(d.sourcePort.node, sourceSub(d).index);
    }

    function subOpacity(d) {
      return !hover || d.node.hover || d.hover ? 1 : 0.5;
    }

    function linkOpacity(d) {
      return !hover || d.source.hover || d.target.hover || sourceSub(d).hover || targetSub(d).hover ? 1 : 0.5;
    }

    function linkSort(a, b) {
      if (sourceSub(a).hover || a.source.hover || targetSub(a).hover || a.target.hover) return 1;
      if (sourceSub(b).hover || b.source.hover || targetSub(b).hover || b.target.hover) return -1;
      return a.source.dy - b.source.dy;
    }

    function portOrder(p) {
      var sub = p.node.subdiv[p.id];
      return sub ? sub.index : 0;
    }

    function portTitle(p) {
      var n = p.node;
      var label = n.subdiv[p.id] ? n.subdiv[p.id].title : '';
      return n.title + (label ? ' (' + label + ')' : '');
    }

    function subColor(node, index) {
      var c = d3.color(node.color || 'grey');
      var k = 0.3;
      return '' + (((index % 2) === 1) ? c.brighter(k) : c.darker(k));
    }

    function nodeSubdivisions(d) {
      var def = [{id: '', node: d, value: d.value, y: 0, dy: d.y1 - d.y0}];
      return expanded[d.id] && d.subdivisions.length ? d.subdivisions : def;
    }

    function renderLinks(links) {
      // Links
      var link = svg.select('.links')
          .selectAll('g')
          .data(links, function(d) { return d.id; });

      link.exit().remove();

      link.transition()
        .style('opacity', linkOpacity);
      link
        .select('path')
        .transition()
        .duration(1000)
        .attrTween('d', interpolateLink);

      var linkEnter = link.enter()
          .append('g')
          .attr('class', 'link');

      linkEnter.append('path')
        .style('fill', linkColour)
        .each(function (d) { this._current = d; })
        .attr('d', linkPath);

      linkEnter.append('title')
        .text(function(d) {
          return portTitle(d.sourcePort) + ' → ' + portTitle(d.targetPort) + ': ' + numberFormat(d.data.value); });

      link = link.merge(linkEnter);

      // Sort the subdivision flows on a consistent basis to avoid interleaving
      // XXX maybe not needed now they are grouped together
      link.sort(linkSort);
      link.select('path').style('fill', linkColour);

    }

    function renderNodes(nodes, skipSubs) {
      // Nodes
      var node = svg.select('.nodes')
          .selectAll('g.node')
          .data(nodes);

      var nodeEnter = node.enter()
          .append('g')
          .attr('class', 'node')
          .call(snode);

      nodeEnter.select('text')
        .attr('class', 'nodeTitle');

      nodeEnter.insert('g', ':first-child').classed('subdivisions', true);

      nodeEnter.on('click', function(d) {
        expandOrCollapseNode(d);
        setDetails(d);
      });

      node = node.merge(nodeEnter);
      node.call(snode);
      if (!skipSubs) updateSubs(node);
    }

    function expandOrCollapseNode(d) {
      if (!expanded[d.id]) {
        hoverEnabled = false;
        expanded[d.id] = 'temp';
        relayoutAndRender(true);
        expanded[d.id] = true;
        relayoutAndRender();
        timeout(function() {
          hoverEnabled = true;
        }, 1000);
      } else {
        hoverEnabled = false;
        expanded[d.id] = 'temp';
        d.hover = true;
        relayoutAndRender();
        timeout(function() {
          expanded[d.id] = false;
          relayoutAndRender();
          d.hover = false;
          hoverEnabled = true;
        }, 1000);
      }
    }

    function updateSubs(node) {
      var subs = node.select('.subdivisions')
          .selectAll('.sub')
          .data(nodeSubdivisions, function(d) { return d.id; })

      subs.transition().style('opacity', subOpacity);

      // ENTER
      var subsEnter = subs.enter()
          .append('g')
          .attr('class', 'sub');

      subsEnter.on('mouseover', function(d) {
        if (!hoverEnabled) return;
        hover = true;
        if (d.id === '') d.node.hover = true;
        else d.hover = true;
        renderNodes(graph.nodes);
        renderLinks(graph.links);
      });

      subsEnter.on('mouseout', function(d) {
        if (!hoverEnabled) return;
        hover = d.hover = d.node.hover = false;
        renderNodes(graph.nodes);
        renderLinks(graph.links);
      });


      subsEnter.append('rect')
        .style('opacity', 1)
        .attr('width', 60);

      subsEnter.append('text')
        .attr('dy', '0.35em');

      subsEnter.append('title');

      // EXIT
      subs.exit().remove();

      // UPDATE
      subs = subs.merge(subsEnter);

      subs.attr('transform', function(d) { return 'translate(0,' + d.y + ')'; });

      subs.select('rect')
        .attr('height', function(d) { return d.dy; })
        .style('fill', function(d) { return subColor(d.node, d.index); });

      subs.select('text')
        .attr('transform', function(d) { return 'translate(4,' + (d.dy / 2) + ')'; })
        .text(function(d) { return d.dy > 10 ? d.label : ''; });

      subs.select('title')
        .text(function(d) { return d.label; });

      node.select('text.nodeTitle')
        .transition().duration(1000)
        .attr('transform', function(d) {
          return expanded[d.id] ? 'translate(-4,-8)' : 'translate(4,' + (d.dy / 2) + ')'; })
        .style('fill', function(d) { return expanded[d.id] ? '#333' : '#000'; });
    }

    function setDetails(d) {
      var details = select('#details');
      details.select('h1').text(d.title)
        .append('small').text(numberFormat(d.value));
      details.select('p').text(d.description);

      details.select('tbody')
        .selectAll('tr')
        .remove();

      var rows = details.select('tbody')
          .selectAll('tr')
          .data(d.subdivisions)
          .enter()
          .append('tr');

      rows.append('td').text(function(d) { return d.label; });
      rows.append('td').text(function(d) { return numberFormat(d.value); });
      rows.append('td').text(function(d) { return d.description; });
    }

    function interpolateLink (b) {
      // XXX should limit radius better
	    b.points.forEach(function (p) {
	      if (p.ri > 1e3) p.ri = 1e3;
	      if (p.ro > 1e3) p.ro = 1e3;
	    });
      var interp = interpolate(linkGeom(this._current), b);
      var that = this;
      return function (t) {
        that._current = interp(t);
        return linkPath(that._current);
      };
    }
  });
}

function linkGeom (l) {
  return {
    points: l.points,
    dy: l.dy
  };
}
