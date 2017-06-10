var app = angular.module("app", []);

app.controller("main", function($scope, $http, $interval) {

    $scope.start = new Date(new Date().setHours(0,0,0,0));
    $scope.end = new Date(new Date().setHours(23,59,59,999));
    width = 600;
    height = 600;
    radius = Math.min(width,height)/2;
    margin = {left:50, right:50, top:50, bottom:50 }
    hours = d3.timeHours($scope.start, $scope.end, 1);
    // radial scales
    radii = {};
    radii["r"] = d3.scaleLinear()
                    .domain([0, 1])
                    .range([radius/2, radius]);

    // range button handlers
    $scope.daysadd = function(sdt, edt, i) {
        sdt.setDate(sdt.getDate()+i);
        edt.setDate(edt.getDate()+i);
        $scope.radialchartUpdate();
    };
    $scope.monthsadd = function(sdt, edt, i) {
        sdt.setMonth(sdt.getMonth()+i);
        edt.setMonth(edt.getMonth()+i);
        $scope.radialchartUpdate();
    };

    // update most recent datapoint
    updateLiveView = function() {
        $http.get("/iocp/current?node="+ $scope.selectedNode)
            .then(function(response) {
                $scope.sample = response.data[0];
                $scope.timestamp = new Date($scope.sample["timestamp"]);
                $scope.datapoints = Object.keys($scope.sample).filter(
                    function(k) {
                        return !(k=="node"|k=="timestamp"|k=="_id");
                    }
                );
            });
    };
    // time elapsed since most recent datapoint
    updateTimeElapsed = function() {
        $scope.timeelapsed = new Date(new Date() - $scope.timestamp);
    };

    // chart setup
    canvas = d3.select("#graph")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
    chart = canvas.append("g")
            // translate & rotate coordinate space
            .attr(
                "transform", "translate("
                + ((width / 2) + margin.left) + ","
                + ((height / 2) + margin.top) + ")"
                + " rotate(180)"
            );

    // radial axis
    gr = chart.append("g")
        .selectAll("g")
            .data(radii.r.ticks(10))
            .enter().append("g")
    gr.append("circle")
        .attr("r", radii.r)
        .attr("style", "fill:none; stroke:grey; stroke-dasharray:1,2;");

    // angular scale
    a = d3.scaleLinear()
        .domain([$scope.start, $scope.end])
        .range([0, Math.PI*2])

    // angular axis
    // TODO: only works for 0-24 constraint
    ga = chart.append("g")
        .selectAll("g")
            .data(hours.map( (d) => a(d)*(180/Math.PI) ))
            .enter().append("g")
                .attr("transform", (d) => "rotate(" + (d - 90) + ")" )
    ga.append("line")
        .attr("x1", radius/2)
        .attr("x2", radius)
        .attr("style", "stroke:black");
    ga.append("text")
        .attr("x", radius + 6)
        .attr("dy", ".35em")
        .text ( (d,i) => hours[i].toLocaleTimeString().substr(0,8) )
            .attr("style", "font: 10px sans-serif")

    // line & area functions
    line = function(type) {
        return d3.radialLine()
            .radius( (d) => radii[type](d[type]) )
            .angle( (d) => a(new Date(d.timestamp)) )
            .curve(d3.curveBasis);
    };
    area = function(type) {
        return d3.radialArea()
            .innerRadius(radius/2)
            .outerRadius( (d) => radii[type](d[type]) )
            .angle( (d) => a(new Date(d.timestamp)) )
            .curve(d3.curveBasis);
    };

    $http.get("iocp/nodes")
        .then(function(response) {

            $scope.nodes = response.data;
            $scope.selectedNode = $scope.nodes[0];

            return $http.get("iocp/types");

        }).then(function(response) {

            types = response.data;
            $scope.types = types;

            // update most recent datapoint badges
            updateLiveView();
            updateTimeElapsed();
            $interval( updateLiveView, 60*1000);
            $interval( updateTimeElapsed, 1000);

            // radial scales for types
            for (k in types) {
                if (k!="node" & k!="timestamp" & k!="_id") {
                    radii[k] = d3.scaleLinear()
                        .domain(types[k].scale)
                        .range([radius/2, radius])
                };
            };
            // TODO: radial axis labelling per datapoint type

            // line and area fns for types
            lines={}, areas={};
            for (k in types) {
                if (k!="node" & k!="timestamp" & k!="_id") {

                    lines[k] = chart.append("path")
                        .attr("style", types[k].areastyle);

                    areas[k] = chart.append("path")
                        .attr("style", types[k].linestyle);

                };
            };

            $scope.radialchartUpdate = function() {
                $http.get(
                        "/iocp/range?node="
                        + $scope.selectedNode
                        + "&start=" + $scope.start.toString()
                        + "&end=" + $scope.end.toString()
                    ).then(function(response) {
                        data = response.data;
                        for (k in types) {
                            lines[k].datum(data)
                                // applying when data.length==0
                                // clears previous chart
                                .attr("d", area(k));
                            areas[k].datum(data)
                                .attr("d", line(k))
                        };
                });
            };
            $scope.radialchartUpdate();

      });

})