define([
    "jquery",
    'select2/utils',
    'select2/results',
    'select2/dropdown/hidePlaceholder'
], function($, Utils, ResultsList, HidePlaceholder) {
    var CascadeResult = function CascadeResult($element, options, dataAdapter) {
        this.$element = $element;
        this.data = dataAdapter;
        this.options = options;

        CascadeResult.__super__.constructor.call(this);
    }

    Utils.Extend(CascadeResult, Utils.Observable);

    CascadeResult.prototype.render = function() {
        var $results = $(
            "<div>\
                        <ul class=\"select2-results__pagelist\">\
                        </ul>\
                        <dl class=\"select2-results__pageitems\">\
                        </dl>\
                    </div>");

        if (this.options.get('multiple')) {
            $results.attr('aria-multiselectable', 'true');
        }

        this.$results = $results;

        $results.on("click", "dd", function() {
            var data = $(this).data("data");
            if (data.hasChild) {
                $results.trigger("results:selectParent", data.id);
                $results.find(".select2-results__page").attr('aria-selected', false)
                    .last().attr('aria-selected', true);
            }
        })

        $results.on("click", ".select2-results__page", function() {
            var data = $(this).data("data");
            $results.trigger("results:selectParent", data.parentId);

        })

        return $results;
    };

    CascadeResult.prototype.clear = function() {
        this.$results.find(".select2-results__pagelist").empty()
        this.$results.find(".select2-results__pageitems").empty()
    };

    CascadeResult.prototype.append = function(data) {
        var self = this;
        self.my_pageData = {
            $pageItemPairs: null,
            parentIds: []
        }
        self.buildPages(data.results, function(pages, rootId) {

            var $pageItemPairs = _.map(pages,
                function(page) {
                    return self.buildPageItemPairs(page);
                })

            self.my_pageData.$pageItemPairs = $pageItemPairs;
            self.parentIds = [];
            self.switchPage(rootId);
        })
    };

    CascadeResult.prototype.buildPageItemPairs = function(page) {
        var $page = $("<li>" + page.text + "</li>");
        $page.addClass("select2-results__page")
        $page.data("data", page);
        var $items = _.map(page.items,
            function(item) {
                var $item = $("<dd>" + item.text + "</dd>");
                $item.data("data", item);
                if (!item.hasChild) {
                    $item.addClass("select2-results__option")
                } else {
                    $item.addClass("select2-results__parent_option")
                }

                if (item.reference.disabled) {
                    $item.attr('aria-disabled', true)
                }

                if (!item.hasChild) {
                    $item.attr("aria-selected", false)
                }

                return $item;
            });
        return { $page: $page, $items: $items, parentId: page.parentId, index: page.index };
    }

    CascadeResult.prototype.buildPages = function(data, callback) {

        function Page(text, index, parentId, items, reference) {
            this.text = text;
            this.index = index;
            this.parentId = parentId;
            this.items = items;
            this.reference = reference;
        }

        function Item(id, text, hasChild, reference) {
            this.id = id;
            this.text = text;
            this.hasChild = hasChild;
            this.reference = reference;
        }

        var parentIdGroups = _.groupBy(data, "parentId");

        var rootKey = _.find(_.keys(parentIdGroups), function(groupKey) {
            return !_.any(data, _.matcher({ id: groupKey }))
        })

        function toPage(datas, level, parentId, callback) {

            var items = _.map(datas, function(data) {
                return new Item(data.id, data.text, !!parentIdGroups[data.id], data);
            })
            var pageName = _.chain(datas).map(function(data) {
                return data.group
            }).unique().value().join("/");
            var page = new Page(pageName, level, parentId, items, datas);
            callback(page);
            _.each(datas, function(data) {
                if (parentIdGroups[data.id]) {
                    toPage(parentIdGroups[data.id], level + 1, data.id, callback);
                }
            })
        }

        var pages = [];
        toPage(parentIdGroups[rootKey], 0, rootKey, function(page) {
            pages.push(page)
        });

        callback(pages, rootKey);
    }

    CascadeResult.prototype.switchPage = function(parentId) {
        var pageData = this.my_pageData;

        var $pageItemPair = _.findWhere(pageData.$pageItemPairs, { parentId: parentId });
        var $pageContainer = this.$results.find(".select2-results__pagelist");
        var $itemContainer = this.$results.find(".select2-results__pageitems");
        var pageIndex = $pageItemPair.index;
        $pageContainer.find(":gt(" + pageIndex + ")").detach();
        $itemContainer.find(">*").detach()
        $pageContainer.append($pageItemPair.$page);
        $itemContainer.append($pageItemPair.$items);
        this.setClasses();
        $pageItemPair.$page.attr('aria-selected', true)
            .siblings().attr('aria-selected', false);
    }

    CascadeResult.prototype.position = function($results, $dropdown) {
        var $resultsContainer = $dropdown.find('.select2-results');
        $resultsContainer.append($results);
    };

    CascadeResult.prototype.sort = function(data) {
        var sorter = this.options.get('sorter');

        return sorter(data);
    };

    CascadeResult.prototype.setClasses = function() {
        var self = this;

        this.data.current(function(selected) {
            var selectedIds = $.map(selected, function(s) {
                return s.id.toString();
            });

            var $options = self.$results
                .find('.select2-results__option[aria-selected]');

            $options.each(function() {
                var $option = $(this);

                var item = $.data(this, 'data');

                // id needs to be converted to a string when comparing
                var id = '' + item.id;

                if ((item.element != null && item.element.selected) ||
                    (item.element == null && $.inArray(id, selectedIds) > -1)) {
                    $option.attr('aria-selected', 'true');
                } else {
                    $option.attr('aria-selected', 'false');
                }
            });

        });
    };

    CascadeResult.prototype.bind = function(container, $container) {
        var self = this;

        var id = container.id + '-results';

        this.$results.attr('id', id);

        container.on('results:all', function(params) {
            self.clear();
            self.append(params.data);

            if (container.isOpen()) {
                self.setClasses();
            }
        });

        container.on('results:append', function(params) {
            self.append(params.data);

            if (container.isOpen()) {
                self.setClasses();
            }
        });

        container.on('select', function() {
            if (!container.isOpen()) {
                return;
            }

            self.setClasses();
        });

        container.on('unselect', function() {
            if (!container.isOpen()) {
                return;
            }

            self.setClasses();
        });

        container.on('open', function() {
            // When the dropdown is open, aria-expended="true"
            self.$results.attr('aria-expanded', 'true');
            self.$results.attr('aria-hidden', 'false');

            self.setClasses();
            // self.ensureHighlightVisible();
        });

        container.on('close', function() {
            // When the dropdown is closed, aria-expended="false"
            self.$results.attr('aria-expanded', 'false');
            self.$results.attr('aria-hidden', 'true');
            self.$results.removeAttr('aria-activedescendant');
        });

        container.on('results:toggle', function() {
            var $highlighted = self.getHighlightedCascadeResult();

            if ($highlighted.length === 0) {
                return;
            }

            $highlighted.trigger('mouseup');
        });

        container.on('results:select', function() {
            var $highlighted = self.getHighlightedCascadeResult();

            if ($highlighted.length === 0) {
                return;
            }

            var data = $highlighted.data('data');

            if ($highlighted.attr('aria-selected') == 'true') {
                self.trigger('close', {});
            } else {
                self.trigger('select', {
                    data: data
                });
            }
        });

        container.on('results:focus', function(params) {
            params.element.addClass('select2-results__option--highlighted');
        });

        this.$results.on('mouseup', '.select2-results__option[aria-selected]',
            function(evt) {
                var $this = $(this);

                var data = $this.data('data');

                if ($this.attr('aria-selected') === 'true') {
                    if (self.options.get('multiple')) {
                        self.trigger('unselect', {
                            originalEvent: evt,
                            data: data
                        });
                    } else {
                        self.trigger('close', {});
                    }

                    return;
                }

                self.trigger('select', {
                    originalEvent: evt,
                    data: data
                });
            });

        this.$results.on('mouseenter', '.select2-results__option[aria-selected] .select2-results__parent_option',
            function(evt) {
                var data = $(this).data('data');

                self.getHighlightedCascadeResult()
                    .removeClass('select2-results__option--highlighted');

                self.trigger('results:focus', {
                    data: data,
                    element: $(this)
                });
            });
        this.$results.on('results:selectParent', function(evt, parentId) {
            self.switchPage(parentId);
        })
    };

    CascadeResult.prototype.getHighlightedCascadeResult = function() {
        var $highlighted = this.$results
            .find('.select2-results__option--highlighted');

        return $highlighted;
    };

    CascadeResult.prototype.destroy = function() {
        this.$results.remove();
    };

    CascadeResult = Utils.Decorate(
        CascadeResult,
        HidePlaceholder
    );
    return CascadeResult;
});
