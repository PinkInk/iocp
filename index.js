var app = angular.module("app", []);

// init shared data
app.run(function($rootScope, $http) {

    // get datapoint types
    $http.get("/iocp/types")
    .then(function typessuccess(response){
        $rootScope.types = response.data;
    });

});

// liveview controller ---------------------------------------------
app.controller("liveview", function($scope, $http, $interval) {

    // fn to get last datapoint
    updateLiveView = function() {
        $http.get("/iocp/current")
        .then(function currentSuccess(response){
            $scope.sample = response.data[0];
            $scope.timestamp = new Date($scope.sample["timestamp"]);
            $scope.datapoints = Object.keys($scope.sample).filter(
                function(k) {
                    return !(k=="node"|k=="timestamp"|k=="_id");
                }
            );
        });
    };

    // fn to get time elapsed since last datapoint
    updateTimeElapsed = function() {
        $scope.timeelapsed = new Date(new Date() - $scope.timestamp);
    };

    // update model
    updateLiveView();
    updateTimeElapsed();
    $interval( updateLiveView, 60*1000)
    $interval( updateTimeElapsed, 1000)

});
// liveview controller ---------------------------------------------

// chart controller ------------------------------------------------
app.controller("chart", function($scope, $http) {

    // node selector
    $http.get("/iocp/nodes")
        .then(function(response){
            $scope.nodes = response.data;
            $scope.selectedNode = $scope.nodes[0];
        });

    // range handlers
    $scope.start = new Date(new Date().setUTCHours(0,0,0,0));
    $scope.end = new Date(new Date().setUTCHours(23,59,59,999));
    $scope.daysadd = function(sdt, edt, i) {
        sdt.setDate(sdt.getDate()+i);
        edt.setDate(edt.getDate()+i);
        linechartUpdate();
    };
    $scope.monthsadd = function(sdt, edt, i) {
        sdt.setMonth(sdt.getMonth()+i);
        edt.setMonth(edt.getMonth()+i);
        linechartUpdate();
    };

    // chart setup
    margin = {top: 10, right: 50, bottom: 50, left: 50};
    width = 900 - margin.right - margin.left;
    height = 400 - margin.top - margin.bottom;

    svg = d3.select("#graph")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

    chart = svg.append("g")
        .attr("transform", "translate(" + margin.left + ", " + margin.top +")" )
        .attr("width", width)
        .attr("height", height);

    // y scales
    ytscale = d3.scaleLinear()
        .domain([20, 80])
        .range([height, 0]); // invert y scale

    yhscale = d3.scaleLinear()
        .domain([0, 100])
        .range([height, 0]); // invert y scale

    ylscale = d3.scaleLinear()
        .domain([0, 65535])
        .range([height, 0]);

    // temp axis & label
    svg.append("g")
        .call(d3.axisLeft(ytscale))
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        // coord system reversed due rotation
        .attr("x", -height/2)
        .attr("y", 0)
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        // TODO: units from types table
        .text("Temperature (°C)");

    // luminance axis & label
    svg.append("g")
        .call(d3.axisRight(yhscale))
        .attr("transform", "translate(" + (width + margin.right) + "," + margin.top + ")");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        // coord system reversed due rotation
        .attr("x", 0-(height/2))
        .attr("y", width+margin.left+margin.right)
        .attr("dy", "-1em")
        .style("text-anchor", "middle")
        // TODO: units from types table
        .text("Humidity (%)");

    // draw chart and time axis
    linechartUpdate = function() {
        $http.get("/iocp/range?start=" + $scope.start.toISOString() + "&end=" + $scope.end.toISOString())
            .then(function(response) {

            // clear chart content
            chart.selectAll("*").remove();

            data = response.data;

            // x (time) scale
            xscale = d3.scaleTime()
                .domain([$scope.start, $scope.end])
                .range([0, width]);

            chart.append("g")
                .call(d3.axisBottom(xscale))
                .attr("transform", "translate(0," + (height) + ")");

            svg.append("text")
                .attr("x", (width+margin.left+margin.right)/2)
                .attr("y", height+margin.top+margin.bottom)
                .attr("text-anchor", "middle")
                .text("Date Time");

            // scale point fns
            x = (d) => xscale(new Date(d.timestamp));
            yt = (d) => ytscale(d.t);
            yh = (d) => yhscale(d.h);
            yl = (d) => ylscale(d.l);

            // temperature
            templine = d3.line()
                .x( x )
                .y( yt )
                .curve(d3.curveBasis);

            chart.append("path")
                .datum(data)
                .attr("d", templine)
                // TODO: should come from sample types query
                .attr("style", "stroke:#f44336; stroke-width: 3; fill:none;");

            // humidity
            humidityline = d3.line()
                .x( x )
                .y( yh )
                .curve(d3.curveBasis);

            chart.append("path")
                .datum(data)
                .attr("d", humidityline)
                // TODO: should come from sample types query
                .attr("style", "stroke:#2196F3; stroke-width: 3; fill:none;");

            // luminance
            luminanceline = d3.line()
                .x( x )
                .y( yl )
                .curve(d3.curveBasis);

            chart.append("path")
                .datum(data)
                .attr("d", luminanceline)
                // TODO: should come from sample types query
                .attr("style", "stroke:#4CAF50; stroke-width: 3; fill:none;");

        });
    };

    // update chart
    linechartUpdate();

});
// chart controller ------------------------------------------------

