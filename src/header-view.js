import _ from "lodash";
import moment from "moment-timezone";
import { actionTypes } from "@servicenow/ui-core";
import { t } from "sn-translate";
import "@servicenow/now-button";
import "@servicenow/now-heading";
import "@servicenow/now-dropdown";
// import "@servicenow/now-record-mini-calendar";
import "./sn-calendar-popover-container/sn-calendar-popover-container";
import {
	evalTemplate,
	isTodayInView,
	getCurrentViewSettings,
	str2Moment,
	dispatchGridClickNewEvent,
	isCreateAllowed2,
	updateCurrentDate,
	renderKeyboardShortcuts,
	renderViewDropDownList,
	getDirProperty,
	isNotToolTipEvent,
} from "./util";
import {
	ACTIONS,
	VIEWS,
	DIRECTION,
	WHEN_OUT_OF_MODE_OPTIONS,
	POPOVERS,
	KEYS,
} from "./constants";
import { createRef } from "@servicenow/ui-renderer-snabbdom";

const TODAY = t("Today");
const VIEW_KEYBOARD_SHORTCUTS = t("View Keyboard Shortcuts");
const SETTINGS = t("Settings");

function getTimezonePicker(state, dispatch) {
	const { properties: props } = state;
	if (props.availableTimezones.length > 1) {
		return (
			<now-dropdown
				selected-items={new Array(props.timezone.toString())}
				className="timezone"
				aria-label={t("Calendar Timezone")}
				select="single"
				placeholder={t("Select Timezone")}
				items={getTimezoneDropdownList(props.availableTimezones)}
				bare
				show-padding
				append-to-payload={{ dropdown: "timezone" }}
				variant="tertiary"
			/>
		);
	}
	return <div className="single-timezone">{t(props.timezone)}</div>;
}

function getTimezoneDropdownList(timezones) {
	const timezoneDropdownList = [];
	timezones.forEach((timezone) => {
		timezoneDropdownList.push({
			...timezone,
			id: timezone.name,
		});
	});
	return timezoneDropdownList;
}

/* *
 * Header Section of calendar having 3 slots.
 */
function renderHeader(state, dispatch) {
	const {
		properties: props,
		startMoment,
		endMoment,
		todayMoment,
		availableViewRenderers,
	} = state;
	const { datePickerTemplates, dateFormat } = props;
	const { currentView, contextDate } = props;
	const datePickerTemplate = datePickerTemplates[currentView];
	const { numberOfDays, viewLabel } = getCurrentViewSettings(state);

	if (!startMoment || !endMoment || !todayMoment) return "";

	let datePickerLabel;

	if (datePickerTemplate) {
		let template, templateRtl;
		if (typeof datePickerTemplate == "object") {
			if (dateFormat.indexOf("MM") > dateFormat.toUpperCase().indexOf("DD")) {
				template = datePickerTemplate["DATE_FIRST"];
			} else {
				template = datePickerTemplate["MONTH_FIRST"];
			}
		} else {
			template = datePickerTemplate;
		}
		datePickerLabel = evalTemplate(template, state);
	} else datePickerLabel = "";

	let datePickerDate =
		contextDate && str2Moment(contextDate, props.timezone).format("YYYY-MM-DD");

	let datePickerRef = createRef();
	let settingsRef = createRef();
	const isDatePickerOpened = state.popOvers[POPOVERS.DATE_PICKER];
	return (
		<div className="calendar-header-container">
			<div className="header-wrapper">
				<div className="cell">
					<slot name="left-header-slot" />
					<now-button
						className="new"
						label={props.customizableLabels.newButton.text}
						icon="plus-outline"
						variant="secondary"
						size="md"
						style={{ display: isCreateAllowed2(state) ? "" : "none" }}
						config-aria={{
							"aria-label": props.customizableLabels.newButton.text,
						}}
						tooltip-content={props.customizableLabels.newButton.text}
						on-click={(e) => {
							if (isNotToolTipEvent(e)) {
								dispatchGridClickNewEvent(
									state,
									dispatch,
									moment(contextDate).startOf("day"),
									moment(contextDate).endOf("day")
								);
							}
						}}
					/>
					<slot name="left-header-btns">
						<now-button-bare
							className="today"
							label={TODAY}
							size="md"
							variant="secondary"
							config-aria={{ "aria-label": TODAY }}
							tooltip-content={TODAY}
							on-click={(e) => {
								if (isNotToolTipEvent(e)) {
									dispatch("PROPERTIES_SET", { contextDate: todayMoment });
								}
							}}
						/>
						<now-button
							className="nav-btn prev"
							icon={getDirProperty("prevNav", state)}
							size="md"
							bare
							config-aria={{ "aria-label": t("Previous {0}", viewLabel) }}
							tooltip-content={t("Previous {0}", viewLabel)}
							on-click={(e) => {
								if (isNotToolTipEvent(e)) {
									updateCurrentDate(state, dispatch, DIRECTION.LEFT);
								}
							}}
						/>
						<now-button
							className="nav-btn next"
							icon={getDirProperty("nextNav", state)}
							size="md"
							bare
							config-aria={{ "aria-label": t("Next {0}", viewLabel) }}
							tooltip-content={t("Next {0}", viewLabel)}
							on-click={(e) => {
								if (isNotToolTipEvent(e)) {
									updateCurrentDate(state, dispatch, DIRECTION.RIGHT);
								}
							}}
						/>
						<now-button-bare
							variant="secondary"
							className="nav-btn date-pick popover-button"
							label={datePickerLabel}
							icon-end="caret-down-outline"
							size="md"
							config-aria={{
								"aria-label": t("Date Picker"),
								"aria-haspop": true,
								"aria-expanded": state.popOvers[POPOVERS.DATE_PICKER],
							}}
							ref={datePickerRef}
							tooltip-content={t("Date Picker")}
							on-click={(e) => {
								if (isNotToolTipEvent(e)) {
									dispatch(ACTIONS.TOGGLE_POPOVER, {
										popOver: POPOVERS.DATE_PICKER,
									});
								}
							}}
						/>
					</slot>
				</div>
				<div className="cell">
					{getTimezonePicker(state, dispatch)}
					<now-dropdown
						className="view"
						aria-label={t("Calendar Views")}
						show-padding
						append-to-payload={{ dropdown: "view" }}
						selected-items={new Array(props.currentView.toString())}
						select="single"
						placeholder={availableViewRenderers[props.currentView].viewLabel}
						items={renderViewDropDownList(state)}
						bare
						variant="tertiary"
					/>
					<slot name="right-header-btns" />
					<now-button
						className="shortcuts popover-button"
						icon="gear-outline"
						size="md"
						variant="secondary"
						config-aria={{ "aria-label": SETTINGS }}
						tooltip-content={SETTINGS}
						on-click={(clickEvent) => {
							if (isNotToolTipEvent(clickEvent)) {
								dispatch(ACTIONS.TOGGLE_POPOVER, {
									popOver: POPOVERS.SETTINGS,
									eventEl: clickEvent.currentTarget,
								});
							}
						}}
						ref={settingsRef}
					/>
				</div>
			</div>
			<div className="popovers-container">
				{isDatePickerOpened ? (
					<sn-calendar-popover-container
						targetRef={datePickerRef}
						opened={true}
						customStyles={{ overflow: "visible", height: "auto" }}
					>
						<div
							className="sn-calendar-popover-content"
							slot="sn-calendar-popover-content"
						>
							<now-record-mini-calendar
								value={datePickerDate}
								firstDayOfWeek={props.firstDayOfWeek}
								language={props.locale}
								reversed={props.dir == DIRECTION.RTL}
								autofocus={true}
								onOk={() => {
									dispatch("PROPERTIES_SET", {
										contextDate: str2Moment(
											datePickerDate + " 00:00:00",
											props.timezone
										),
									});
									dispatch(ACTIONS.TOGGLE_POPOVER, { popOver: "datePicker" });
								}}
								onValueChange={(event, name, value) => (datePickerDate = value)}
							/>
						</div>
					</sn-calendar-popover-container>
				) : null}
				<sn-calendar-popover-container
					targetRef={settingsRef}
					opened={
						state.popOvers[POPOVERS.SETTINGS] &&
						state.popOvers[POPOVERS.SETTINGS].opened
					}
					rePositionPopover={state.rePositionPopover}
				>
					<div
						className="sn-calendar-popover-content"
						slot="sn-calendar-popover-content"
					>
						<div className="settings-container">
							{state.showKeyBoardShortCuts ? (
								""
							) : (
								<now-button-bare
									className="show-keyboard-shortcuts"
									label={VIEW_KEYBOARD_SHORTCUTS}
									size="md"
									variant="secondary"
									config-aria={{ "aria-label": VIEW_KEYBOARD_SHORTCUTS }}
									on-click={() => {
										dispatch(ACTIONS.INTERNAL_STATE_SET, {
											showKeyBoardShortCuts: true,
											rePositionPopover: state.rePositionPopover
												? ++state.rePositionPopover
												: 2,
										});
									}}
								/>
							)}

							{renderKeyboardShortcuts(state, dispatch)}
						</div>
					</div>
				</sn-calendar-popover-container>
			</div>
		</div>
	);
}

export const ActionHandlers = {
	[actionTypes.COMPONENT_PROPERTY_CHANGED]: ({
		state,
		dispatch,
		action: {
			payload: { name, previousValue, value },
		},
	}) => {
		if (name === "currentMode") {
			const newMode = value;
			const { availableViewRenderers = {} } = state;
			const r = _.find(
				Object.values(availableViewRenderers),
				(r) => r.mode === newMode && r.modeDefault
			);
			if (r) dispatch("PROPERTIES_SET", { currentView: r.viewName });
		}
	},
};

export default renderHeader;
