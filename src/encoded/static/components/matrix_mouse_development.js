import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
// import * as encoding from '../libs/query_encoding';
// import { svgIcon } from '../libs/svg-icons';
// import { Panel, PanelBody } from '../libs/ui/panel';
// import DataTable from './datatable';
import * as globals from './globals';
// import { matrixAssaySortOrder, MATRIX_VISUALIZE_LIMIT, SearchFilter } from './matrix';
// import { MatrixInternalTags } from './objectutils';
// import { SearchControls } from './search';


/**
 * View component for the ENTEx matrix page.
 */
const MouseDevelopmentMatrix = () => <h4>I am a mouse development matrix</h4>;

// MouseDevelopmentMatrix.propTypes = {
//     /** ENTEx matrix object */
//     context: PropTypes.object.isRequired,
// };

MouseDevelopmentMatrix.contextTypes = {
    location_href: PropTypes.string,
};

globals.contentViews.register(MouseDevelopmentMatrix, 'MouseDevelopmentMatrix');
