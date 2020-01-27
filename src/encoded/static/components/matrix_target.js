import React from 'react';
import PropTypes from 'prop-types';
import pluralize from 'pluralize';
import url from 'url';
import PubSub from 'pubsub-js';
import QueryString from '../libs/query_string';
import { Panel, PanelBody, TabPanel, TabPanelPane } from '../libs/ui/panel';
import { Modal, ModalHeader, ModalBody } from '../libs/ui/modal';
import { svgIcon } from '../libs/svg-icons';
import * as globals from './globals';
import { MatrixInternalTags } from './objectutils';
import { SearchFilter } from './matrix';
import { TextFilter, SearchControls } from './search';
import DataTable from './datatable';


const VISUALIZE_LIMIT = 500;
const SEARCH_PERFORMED_PUBSUB = 'searchPerformed';
const SEARCH_RESULT_COUNT_PUBSUB = 'searchResultCount';
const CLEAR_SEARCH_BOX_PUBSUB = 'clearSearchBox';

/**
 * Tranform context to a form where easier to fetch information
 *
 * @param {context} context - Context from react
 * @param {string} assayTitle - Assay Title
 * @param {string} organismName - Organism Name
 * @returns {object} - Object with structure - { targetData, subTabs, subTabsHeaders };
 *
 *      targetData is an object where:
 *          key is a sub Tab
 *          value is of structure - { headerRow, dataRow, assayTitle, organismName };
 *              headerRow - header content
 *              dataRow - non-header content
 *              assayTitle - Assay title
 *              organismName- Organism name
 *      subTabs: List of subTabs for easy access
 *      subTabsHeaders- List of Sub tab headers
 */
const getTargetData = (context, assayTitle, organismName) => {
    if (!context || !context.matrix || !context.matrix.x || !context.matrix.y || !assayTitle || !organismName) {
        return null;
    }

    const subTabSource = 'biosample_ontology.classification';
    const subTabList = context.matrix.x[subTabSource].buckets.map(x => x.key);
    const targetData = {};

    subTabList.forEach((subTab) => {
        const xGroupBy1 = context.matrix.x.group_by[0];
        const xGroupBy2 = context.matrix.x.group_by[1];
        const headerRow = context.matrix.x[xGroupBy1].buckets.find(f => f.key === subTab)[xGroupBy2]
            .buckets
            .reduce((a, b) => {
                const m = a.concat(b);
                return m;
            }, [])
            .map(x => x.key);
        const headerRowIndex = headerRow.reduce((x, y, z) => { x[y] = z; return x; }, []);
        const headerRowLength = headerRow.length;
        const yGroupBy1 = context.matrix.y.group_by[0];
        const yGroupBy2 = context.matrix.y.group_by[1];

        const yData = context.matrix.y[yGroupBy1].buckets
            .find(rBucket => rBucket.key === organismName)[yGroupBy2].buckets
            .reduce((a, b) => {
                const m = {};
                let c;
                m[b.key] = b[xGroupBy1].buckets
                    .filter(f => f.key === subTab)
                    .reduce((x, y) => {
                        x.push(y[xGroupBy2].buckets
                            .reduce((i, j) => i.concat(j), []));
                        return x;
                    }, []);
                return a.concat(m);
            }, []);

        const dataRowT = {};

        yData.forEach((y) => {
            const yKey = Object.keys(y)[0];
            dataRowT[yKey] = dataRowT[yKey] || [...Array(headerRowLength + 1)].fill(0);
            dataRowT[yKey][0] = yKey;

            const keyDocCountPair = y[yKey].reduce((a, b) => {
                const m = a.concat(b);
                return m;
            }, []);

            keyDocCountPair.forEach((kp) => {
                const key = kp.key;
                const docCount = kp.doc_count;
                const index = headerRowIndex[key];
                dataRowT[yKey][index + 1] = docCount;
            });
        });

        const dataRow = [];
        const keys = Object.keys(dataRowT);

        keys.forEach((key) => {
            dataRow.push(dataRowT[key]);
        });
        targetData[subTab] = { headerRow, dataRow, assayTitle, organismName };
    });

    const subTabs = subTabList;
    const subTabsHeaders = [];

    subTabList.forEach((subTab) => {
        subTabsHeaders.push({ title: subTab });
    });
    return { targetData, subTabs, subTabsHeaders };
};


/**
 * Get search result-count
 *
 * @param {targetData} targetData
 * @returns Number 0 or higher that corresponds to search count
 */
const getSearchResultCount = (targetData) => {
    const count = targetData.dataRow
        .reduce((a, b) => [...a, ...b], [])
        .filter(i => !isNaN(i))
        .reduce((a, b) => a + b, 0);

    return count;
};

/**
 * Transform target data to a form DataTable-object can understand.
 *
 * @param {targetData} targetData
 * @param {string} selectedSubTab - Sub tab to use
 * @returns {object} DataTable-ready structure.
 */
const convertTargetDataToDataTable = (targetData, selectedSubTab) => {
    if (!targetData || !targetData.headerRow || !targetData.dataRow) {
        return {
            rows: [],
            rowKeys: [],
            tableCss: 'matrix',
        };
    }

    const dataTable = [];
    const headerRow = targetData.headerRow.map(x => ({
        header: <a href={`/search/?type=Experiment&status=released&replicates.library.biosample.donor.organism.scientific_name=${targetData.organismName}&biosample_ontology.term_name=${x}&assay_title=${targetData.assayTitle}`}><span title={x}>{x}</span></a>,
    }));

    dataTable.push({
        rowContent: [{ header: null }, ...headerRow],
        css: 'matrix__col-category-header',
    });

    const rowLength = targetData.dataRow.length > 0 ? targetData.dataRow[0].length : 0;

    const rowData = targetData.dataRow.map((row, rIndex) => {
        const rowContent = row.map((y, yIndex) => {
            let content;

            if (yIndex === 0) {
                const borderLeft = '1px solid #fff'; // make left-most side border white
                content = {
                    header: <a href={`/search/?type=Experiment&status=released&target.label=${row[0]}&assay_title=${targetData.assayTitle}&replicates.library.biosample.donor.organism.scientific_name=${targetData.organismName}&biosample_ontology.classification=${selectedSubTab}`}><span title={y}>{y}</span></a>,
                    style: { borderLeft },
                };
            } else {
                const borderTop = rIndex === 0 ? '1px solid #f0f0f0' : ''; // add border color to topmost rows
                const backgroundColor = y === 0 ? '#FFF' : '#688878'; // determined if box is colored or not
                const borderRight = yIndex === rowLength - 1 ? '1px solid #f0f0f0' : ''; // add border color to right-most rows
                content = {
                    content: <a href={`/search/?type=Experiment&status=released&target.label=${row[0]}&assay_title=${targetData.assayTitle}&biosample_ontology.term_name=${targetData.headerRow[yIndex - 1]}&replicates.library.biosample.donor.organism.scientific_name=${targetData.organismName}&biosample_ontology.classification=${selectedSubTab}`}><span title={y}>&nbsp;</span></a>,
                    style: { backgroundColor, borderTop, borderRight },
                };
            }
            return content;
        });
        const css = 'matrix__row-data';

        return { rowContent, css };
    });

    dataTable.push(...rowData);

    const matrixConfig = {
        rows: dataTable,
        tableCss: 'matrix',
    };

    return matrixConfig;
};

const Spinner = ({ isSpinnerActive }) => (isSpinnerActive ?
    <div className="communicating">
        <div className="loading-spinner" />
    </div> :
    <div className="done">
        <span>&nbsp;</span>
    </div>);

Spinner.propTypes = {
    isSpinnerActive: PropTypes.bool,
};

Spinner.defaultProps = {
    isSpinnerActive: false,
};


/**
 * Tab data
 *
 * Note: The server does not return all of this data. So it is hard-coded to make it ever-available.
 */
const headers = [
    {
        organismName: 'Homo sapiens',
        assayTitle: 'Histone ChIP-seq',
        title: 'Homo sapiens | Histone ChIP-seq',
        url: 'replicates.library.biosample.donor.organism.scientific_name=Homo sapiens&assay_title=Histone ChIP-seq',
    }, {
        organismName: 'Homo sapiens',
        assayTitle: 'TF ChIP-seq',
        title: 'Homo sapiens | TF ChIP-seq',
        url: 'replicates.library.biosample.donor.organism.scientific_name=Homo sapiens&assay_title=TF ChIP-seq',
    }, {
        organismName: 'Mus musculus',
        assayTitle: 'Histone ChIP-seq',
        title: 'Mus musculus | Histone ChIP-seq',
        url: 'replicates.library.biosample.donor.organism.scientific_name=Mus musculus&assay_title=Histone ChIP-seq',
    }, {
        organismName: 'Mus musculus',
        assayTitle: 'TF ChIP-seq',
        title: 'Mus musculus | TF ChIP-seq',
        url: 'replicates.library.biosample.donor.organism.scientific_name=Mus musculus&assay_title=TF ChIP-seq',
    },
];

/**
 * Target Matrix text filter.
 *
 *  Important to extend TextFilter because this class has functionality it lacks like
 *  knowing when to clear text book via Pubsub subscription
 *
 * @class TargetMatrixTextFilter
 * @extends {TextFilter}
 */
class TargetMatrixTextFilter extends TextFilter {
    constructor() {
        super();

        this.handleChange = this.handleChange.bind(this);
        this.clearSearch = this.clearSearch.bind(this);

        this.state = { searchOption: 'biosample' };
        this.searchBox = React.createRef();
    }

    componentDidMount() {
        this.clearSearchPubSub = PubSub.subscribe(CLEAR_SEARCH_BOX_PUBSUB, this.clearSearch);
    }

    componentWillUnmount() {
        PubSub.unsubscribe(this.clearSearchPubSub.unsubscribe);
    }

    clearSearch() {
        if (this.searchBox && this.searchBox.current) {
            this.searchBox.current.value = '';
        }
    }

    onKeyDown(e) {
        if (e.keyCode === 13) {
            e.preventDefault();
            PubSub.publish(SEARCH_PERFORMED_PUBSUB, {
                text: e.target.value,
                option: this.state.searchOption,
            });
        }
    }

    handleChange(e) {
        this.setState({ searchOption: e.target.value });
    }

    render() {
        return (
            <div className="facet target-matrix-search">
                <input
                    type="search"
                    className="search-query"
                    placeholder="Enter search term(s)"
                    defaultValue={this.getValue(this.props)}
                    onKeyDown={this.onKeyDown}
                    data-test="filter-search-box"
                    ref={this.searchBox}
                />
                <select name="searchOption" onChange={this.handleChange}>
                    <option value="biosample">Biosample</option>
                    <option value="target">Target</option>
                </select>
            </div>
        );
    }
}

/**
 * Hold code and markup for search
 *
 * SearchFilter extended rather than used because this class has function is does not like use
 * of TargetMatrixTextFilter
 *
 * @class TargetMatrixSearch
 * @extends {SearchFilter}
 */
class TargetMatrixSearch extends SearchFilter {
    render() {
        const { context } = this.props;
        const parsedUrl = url.parse(this.context.location_href);
        const matrixBase = parsedUrl.search || '';
        const matrixSearch = matrixBase + (matrixBase ? '&' : '?');
        const parsed = url.parse(matrixBase, true);
        const queryStringType = parsed.query.type || '';
        const type = pluralize(queryStringType.toLocaleLowerCase());
        return (
            <div className="matrix-general-search">
                <p>Enter search terms to filter the {type} included in the target matrix.</p>
                <div className="general-search-entry">
                    <i className="icon icon-search" />
                    <div className="searchform">
                        <TargetMatrixTextFilter filters={context.filters} searchBase={matrixSearch} onChange={this.onChange} />
                    </div>
                </div>
            </div>
        );
    }
}


/**
 * Render the area above the matrix itself, including the page title.
 *
 * @class TargetMatrixHeader
 * @extends {React.Component}
 */
class TargetMatrixHeader extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            context: this.props.context,
            searchResultCount: this.props.context.total,
        };
        this.setSearchResultCount = this.setSearchResultCount.bind(this);
    }

    componentDidMount() {
        this.searchCount = PubSub.subscribe(SEARCH_RESULT_COUNT_PUBSUB, this.setSearchResultCount);
    }

    componentWillUnmount() {
        PubSub.unsubscribe(this.searchCount);
    }

    setSearchResultCount(message, searchResultCount) {
        this.setState({ searchResultCount });
    }

    render() {
        const visualizeDisabledTitle = this.state.context.total > VISUALIZE_LIMIT ? `Filter to ${VISUALIZE_LIMIT} to visualize` : '';

        return (
            <div className="matrix-header">
                <div className="matrix-header__title">
                    <h1>{this.state.context.title}</h1>
                    <div className="matrix-tags">
                        <MatrixInternalTags context={this.state.context} />
                    </div>
                </div>
                <div className="matrix-header__controls">
                    <div className="matrix-header__target-filter-controls">
                        <TargetMatrixSearch context={this.state.context} />
                    </div>
                    <div className="matrix-header__target-search-controls">
                        <h4>Showing {this.state.searchResultCount} results</h4>
                        <SearchControls context={this.state.context} visualizeDisabledTitle={visualizeDisabledTitle} hideBrowserSelector />
                    </div>
                </div>
            </div>
        );
    }
}


TargetMatrixHeader.propTypes = {
    context: PropTypes.object.isRequired,
};

const TargetMatrixContent = ({ context }) => (
    <div className="matrix__content matrix__content--target">
        <TargetMatrixPresentation context={context} />
    </div>
);

TargetMatrixContent.propTypes = {
    context: PropTypes.object.isRequired,
};

/**
 * Component for creating tab-markup.
 *
 * @class TargetTabPanel
 * @extends {React.Component}
 */
class TargetTabPanel extends React.Component {
    render() {
        const { tabs, navCss, moreComponents, moreComponentsClasses, tabFlange, decoration, decorationClasses, selectedTab, handleTabClick, fontColors } = this.props;
        let children = [];
        let firstPaneIndex = -1; // React.Children.map index of first <TabPanelPane> component

        // We expect to find <TabPanelPane> child elements inside <TabPanel>. For any we find, get
        // the React `key` value and copy it to an `id` value that we add to each child component.
        // That lets each child get an HTML ID matching `key` without having to pass both a key and
        // id with the same value. We also set the `active` property in the TabPanelPane component
        // here too so that each pane knows whether it's the active one or not. ### React14
        if (this.props.children) {
            children = React.Children.map(this.props.children, (child, i) => {
                if (child.type === TabPanelPane) {
                    firstPaneIndex = firstPaneIndex === -1 ? i : firstPaneIndex;

                    // Replace the existing child <TabPanelPane> component
                    const active = this.getCurrentTab() === child.key;
                    return React.cloneElement(child, { id: child.key, active });
                }
                return child;
            });
        }

        const baseUrl = '/target-matrix/?type=Experiment';

        return (
            <div className="target-matrix__data-wrapper">
                <div className="tab-nav">
                    <ul className={`nav-tabs${navCss ? ` ${navCss}` : ''}`} role="tablist">
                        {tabs.map((tab, index) => (
                            <li key={index} role="presentation" aria-controls={tab.title} className={selectedTab === tab.title ? 'active' : ''}>
                                <a href={tab.url ? `${baseUrl}&${tab.url}&status=released` : `#${tab.title}`} data-key={index} onClick={handleTabClick} style={{ color: fontColors ? fontColors[index] : 'black' }}>
                                    {tab.title}
                                </a>
                            </li>
                        ))}
                        {moreComponents ? <div className={moreComponentsClasses}>{moreComponents}</div> : null}
                    </ul>
                    {decoration ? <div className={decorationClasses}>{decoration}</div> : null}
                    {tabFlange ? <div className="tab-flange" /> : null}
                </div>
                <div className="tab-content">
                    {children}
                </div>
            </div>
        );
    }
}

TargetTabPanel.propTypes = {
    /** Object with tab=>pane specifications */
    tabs: PropTypes.object.isRequired,
    /** key of tab to select (must provide handleTabClick) too; null for no selection */
    selectedTab: PropTypes.string,
    /** Classes to add to navigation <ul> */
    navCss: PropTypes.string,
    /** Other components to render in the tab bar */
    moreComponents: PropTypes.object,
    /** Classes to add to moreComponents wrapper <div> */
    moreComponentsClasses: PropTypes.string,
    /** True to show a small full-width strip under active tab */
    tabFlange: PropTypes.bool,
    /** Component to render in the tab bar */
    decoration: PropTypes.object,
    /** CSS classes to wrap decoration in */
    decorationClasses: PropTypes.string,
    /** If selectedTab is provided, then parent must keep track of it */
    handleTabClick: PropTypes.func,
    children: PropTypes.node,
    fontColors: PropTypes.array,
};

TargetTabPanel.contextTypes = {
    location_href: PropTypes.string,
    navigate: PropTypes.func,
};

TargetTabPanel.defaultProps = {
    fontColors: null,
    selectedTab: '',
    navCss: null,
    moreComponents: null,
    moreComponentsClasses: '',
    tabFlange: false,
    decoration: null,
    decorationClasses: null,
    handleTabClick: null,
    children: null,
};


/**
 * Used for creating modal pop up that gathers information on what organism a user wants to view.
 *
 */
const GetTargets = () => (
    <Modal>
        <ModalHeader closeModal={false} addCss="matrix__modal-header">
            <h2>ChIP Target Matrix &mdash; choose organism</h2>
        </ModalHeader>
        <ModalBody addCss="target-matrix__organism-selector">
            <div>Organism to view in matrix:</div>
            <div className="selectors">
                {['Homo sapiens', 'Mus musculus'].map((organism, index) =>
                    <a key={index} className={`btn btn-info btn__selector--${organism.replace(/ /g, '-')}`} href={`/target-matrix/?type=Experiment&replicates.library.biosample.donor.organism.scientific_name=${organism}&assay_title=Histone%20ChIP-seq&status=released`}>{organism}</a>
                )}
            </div>
        </ModalBody>
    </Modal>);

/**
 * Container for Target Matrix page's content.
 *
 * @class TargetMatrixPresentation
 * @extends {React.Component}
 * @listens PubSub - SEARCH_PERFORMED_PUBSUB
 */
class TargetMatrixPresentation extends React.Component {
    constructor(props) {
        super(props);

        this.subTabClicked = this.subTabClicked.bind(this);
        this.performSearch = this.performSearch.bind(this);
        this.handleOnScroll = this.handleOnScroll.bind(this);
        this.handleScrollIndicator = this.handleScrollIndicator.bind(this);

        const { context } = this.props;
        const link = context['@id'];
        const query = new QueryString(link);
        const assayTitle = query.getKeyValues('assay_title')[0];
        const organismName = query.getKeyValues('replicates.library.biosample.donor.organism.scientific_name')[0];
        const data = getTargetData(context, assayTitle, organismName);

        this.targetMatrixData = Object.assign({}, data);
        this.subTabs = data ? data.subTabs : [];
        this.subTabsHeaders = data ? data.subTabsHeaders : [];
        const selectedSubTab = data && data.subTabs && data.subTabs.length > 0 ? data.subTabs[0] : null;
        const targetData = data ? data.targetData[selectedSubTab] : {};

        this.state = {
            targetData,
            selectedTab: `${organismName} | ${assayTitle}`,
            selectedSubTab,
            scrolledRight: false,
            isSpinnerActive: true,
            showOrganismRequest: false,
        };
    }

    componentDidMount() {
        this.handleScrollIndicator(this.scrollElement);
        const { context } = this.props;
        const link = context['@id'];
        const query = new QueryString(link);
        const assayTitle = query.getKeyValues('assay_title')[0];
        const organismName = query.getKeyValues('replicates.library.biosample.donor.organism.scientific_name')[0];
        const showOrganismRequest = !(assayTitle && organismName);
        this.searchSubcription = PubSub.subscribe(SEARCH_PERFORMED_PUBSUB, this.performSearch);

        this.setState({
            isSpinnerActive: false,
            showOrganismRequest,
        });
    }

    componentDidUpdate() {
        // Updates only happen for scrolling on this page. Every other update causes an
        // unmount/mount sequence.
        this.handleScrollIndicator(this.scrollElement);

        if (this.state.isSpinnerActive) {
            this.setState({ isSpinnerActive: false });
        }
    }

    componentWillUnmount() {
        PubSub.unsubscribe(this.searchSubcription);
    }

    /**
     * A subtab is clicked.
     *
     *  Its mains job is to extract required data from targetData object. This is computationally cheaper than
     *  refetching a new context and going off that.
     *
     * @param {object} e - event object
     * @memberof TargetMatrixPresentation
     */
    subTabClicked(e) {
        PubSub.publish(CLEAR_SEARCH_BOX_PUBSUB, {});
        this.setState({ isSpinnerActive: true });
        const index = Number(e.target.dataset.key);
        const selectedSubTab = this.subTabs[isNaN(index) ? 0 : index];
        const targetData = this.targetMatrixData.targetData[selectedSubTab];
        this.setState({ selectedSubTab, targetData });
        const count = getSearchResultCount(targetData);
        PubSub.publish(SEARCH_RESULT_COUNT_PUBSUB, count);
    }

    /**
     * User is searching
     *
     * PubSub used because it is easier to let anyone clear search box and/or get search data
     *
     * @param {string} message - Message from PubSub
     * @param {object} searchData - Information on what search user is doing
     * @memberof TargetMatrixPresentation
     */
    performSearch(message, searchData) {
        const searchText = searchData.text.toLocaleLowerCase().trim();
        const targetData = Object.assign({}, this.targetMatrixData.targetData[this.state.selectedSubTab]);
        let dataRow = [];
        let headerRow = [];

        this.setState({ isSpinnerActive: true });

        if (searchText) {
            const searchField = searchData.option === 'biosample' ? 'headerRow' : 'dataRow';
            const selectedAxis = targetData[searchField] || [];

            if (searchField === 'headerRow') {
                const filterResultIndexes = selectedAxis.map((m, i) => {
                    if (m.toLocaleLowerCase().indexOf(searchText) !== -1) {
                        return i;
                    }
                    return null;
                }).filter(m => m !== null);

                const dataRowLength = targetData.dataRow.length;

                // .fill([]) duplicate the same array reference rather than create a new array
                // so map was used
                dataRow = [...Array(dataRowLength)].map(() => []);

                headerRow = [];

                filterResultIndexes.forEach((i) => {
                    headerRow.push(targetData.headerRow[i]);
                });

                for (let j = 0; j < dataRowLength; j += 1) {
                    // get text of first entry (target)
                    dataRow[j].push(targetData.dataRow[j][0]);

                    // get entries other than the first
                    for (let k = 0; k < filterResultIndexes.length; k += 1) {
                        // header row is offset by 1 compared to data row
                        dataRow[j].push(targetData.dataRow[j][filterResultIndexes[k] + 1]);
                    }
                }
            } else {
                dataRow = selectedAxis.map(y => (y[0].trim().toLocaleLowerCase().indexOf(searchText) !== -1 ? y : null)).filter(f => f !== null);
                headerRow = targetData.headerRow;
            }

            // clear data if both data or header row if either is empty, so show no-data message
            if (headerRow.length === 0) {
                dataRow = [];
            } else if (dataRow.length === 0) {
                headerRow = [];
            }

            targetData.headerRow = headerRow;
            targetData.dataRow = dataRow;
        }

        const count = getSearchResultCount(targetData);
        PubSub.publish(SEARCH_RESULT_COUNT_PUBSUB, count);
        this.setState({ targetData });
    }

    /**
     * Called when the user scrolls the matrix horizontally within its div to handle scroll
     * indicators.
     * @param {object} e React synthetic scroll event
     */
    handleOnScroll(e) {
        this.handleScrollIndicator(e.target);
    }

    /**
     * Show a scroll indicator depending on current scrolled position.
     * @param {object} element DOM element to apply shading to
     */
    handleScrollIndicator(element) {
        if (element) {
            // Have to use a "roughly equal to" test because of an MS Edge bug mentioned here:
            // https://stackoverflow.com/questions/30900154/workaround-for-issue-with-ie-scrollwidth
            const scrollDiff = Math.abs((element.scrollWidth - element.scrollLeft) - element.clientWidth);
            if (scrollDiff < 2 && !this.state.scrolledRight) {
                // Right edge of matrix scrolled into view.
                this.setState({ scrolledRight: true });
            } else if (scrollDiff >= 2 && this.state.scrolledRight) {
                // Right edge of matrix scrolled out of view.
                this.setState({ scrolledRight: false });
            }
        } else if (!this.state.scrolledRight) {
            this.setState({ scrolledRight: true });
        }
    }

    render() {
        const { context } = this.props;
        const { scrolledRight, targetData, showOrganismRequest, selectedSubTab } = this.state;
        const fontColors = globals.biosampleTypeColors.colorList(this.targetMatrixData.subTabs, { merryGoRoundColors: true });

        return (
            <div className="matrix__presentation">
                <Spinner isSpinnerActive={this.state.isSpinnerActive} />
                <div className={`matrix__label matrix__label--horz${!scrolledRight ? ' horz-scroll' : ''}`}>
                    <span>biosample</span>
                    {svgIcon('largeArrow')}
                </div>
                <div className="matrix__presentation-content">
                    <div className="matrix__label matrix__label--vert"><div>{svgIcon('largeArrow')}{context.matrix.y.label}</div></div>
                    {showOrganismRequest ? <GetTargets /> : null }
                    <TargetTabPanel tabs={headers} selectedTab={this.state.selectedTab} tabPanelCss="matrix__data-wrapper">
                        <TargetTabPanel tabs={this.subTabsHeaders} selectedTab={selectedSubTab} tabPanelCss="matrix__data-wrapper" handleTabClick={this.subTabClicked} fontColors={fontColors}>
                            {targetData && targetData.headerRow && targetData.headerRow.length !== 0 && targetData.dataRow && targetData.dataRow.length !== 0 ?
                                  <div className="matrix__data" onScroll={this.handleOnScroll} ref={(element) => { this.scrollElement = element; }}>
                                      <DataTable tableData={convertTargetDataToDataTable(targetData, selectedSubTab)} />
                                  </div>
                              :
                                  <div className="target-matrix__warning">
                                      { targetData && Object.keys(targetData).length === 0 ? 'Select an organism to view data.' : 'No data to display.' }
                                  </div>
                            }
                            <br />
                        </TargetTabPanel>
                        <br />
                    </TargetTabPanel>
                </div>
            </div>);
    }
}

TargetMatrixPresentation.propTypes = {
    context: PropTypes.object.isRequired,
};

TargetMatrixPresentation.contextTypes = {
    navigate: PropTypes.func,
    location_href: PropTypes.string,
    session: PropTypes.object,
    session_properties: PropTypes.object,
};


/**
 * Container for Target Matrix page.
 *
 * @param {context}  context - Context object
 * @returns
 */
const TargetMatrix = ({ context }) => {
    const itemClass = globals.itemClass(context, 'view-item');

    return (
        <Panel addClasses={itemClass}>
            <PanelBody>
                <TargetMatrixHeader context={context} />
                <TargetMatrixContent context={context} />
            </PanelBody>
        </Panel>
    );
};

TargetMatrix.propTypes = {
    context: PropTypes.object.isRequired,
};

TargetMatrix.contextTypes = {
    location_href: PropTypes.string,
    navigate: PropTypes.func,
    biosampleTypeColors: PropTypes.object, // DataColor instance for experiment project
};

globals.contentViews.register(TargetMatrix, 'TargetMatrix');
