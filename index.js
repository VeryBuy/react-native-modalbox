import React, { Component } from "react";
import {
  View,
  StyleSheet,
  PanResponder,
  Animated,
  TouchableWithoutFeedback,
  Easing,
  BackHandler as BackButton,
  Platform,
  Keyboard,
  PanResponderInstance,
  StyleProp,
  ViewStyle,
  Dimensions
} from "react-native";

import Modal from "./Modal";

import { EasingFunction } from "react-native-animatable";

interface Props {
  isOpen?: boolean;
  isDisabled?: boolean;
  startOpen: boolean;
  backdropPressToClose?: boolean;
  swipeToClose?: boolean;
  swipeThreshold: number;
  swipeArea?: number;
  position?: string;
  entry?: string;
  backdrop?: boolean;
  backdropOpacity?: number;
  backdropColor?: string;
  backdropContent?: React.ReactNode;
  animationDuration?: number;
  backButtonClose?: boolean;
  easing?: EasingFunction;
  coverScreen?: boolean;
  keyboardTopOffset: number;
  onClosed?: Function;
  onOpened?: Function;
  onClosingState?: Function;
  onLayout?: Function;
  style?: StyleProp<ViewStyle>;
  useNativeDriver?: boolean;
}
interface States {
  position: Animated.Value;
  backdropOpacity: Animated.Value;
  isOpen: boolean;
  isAnimateClose: boolean;
  isAnimateOpen: boolean;
  swipeToClose: boolean;
  height: number;
  width: number;
  containerHeight: number;
  containerWidth: number;
  isInitialized: boolean;
  keyboardOffset: number;
  isAnimateBackdrop: boolean;
  animBackdrop?: Animated.CompositeAnimation;
  animOpen?: Animated.CompositeAnimation;
  animClose?: Animated.CompositeAnimation;
  pan?: PanResponderInstance;
  positionDest: number;
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "transparent"
  },

  transparent: {
    zIndex: 2,
    backgroundColor: "rgba(0,0,0,0)"
  },

  absolute: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  }
});

const screen = Dimensions.get("window");
export default class ModalBox extends Component<Props, States> {
  static defaultProps = {
    startOpen: false,
    backdropPressToClose: true,
    swipeToClose: true,
    swipeThreshold: 50,
    position: "center",
    backdrop: true,
    backdropOpacity: 0.5,
    backdropColor: "black",
    backdropContent: null,
    animationDuration: 400,
    backButtonClose: false,
    easing: Easing.elastic(0.8),
    coverScreen: false,
    keyboardTopOffset: Platform.OS === "ios" ? 22 : 0,
    useNativeDriver: true
  };
  constructor(props) {
    super(props);
    this.state = {
      position: this.props.startOpen
        ? new Animated.Value(0)
        : new Animated.Value(
            this.props.entry === "top" ? -screen.height : screen.height
          ),
      backdropOpacity: new Animated.Value(0),
      isOpen: this.props.startOpen,
      isAnimateClose: false,
      isAnimateOpen: false,
      swipeToClose: false,
      height: screen.height,
      width: screen.width,
      containerHeight: screen.height,
      containerWidth: screen.width,
      isInitialized: false,
      keyboardOffset: 0,
      isAnimateBackdrop: false,
      positionDest: 0
      // animBackdrop:
    };
    this.onBackPress = this.onBackPress.bind(this);
    this.onViewLayout = this.onViewLayout.bind(this);
    this.handleOpenning = this.handleOpenning.bind(this);
    this.onKeyboardHide = this.onKeyboardHide.bind(this);
    this.onKeyboardChange = this.onKeyboardChange.bind(this);
    this.animateBackdropOpen = this.animateBackdropOpen.bind(this);
    this.animateBackdropClose = this.animateBackdropClose.bind(this);
    this.stopAnimateOpen = this.stopAnimateOpen.bind(this);
    this.animateOpen = this.animateOpen.bind(this);
    this.stopAnimateClose = this.stopAnimateClose.bind(this);
    this.animateClose = this.animateClose.bind(this);
    this.calculateModalPosition = this.calculateModalPosition.bind(this);
    this.createPanResponder = this.createPanResponder.bind(this);
    this.onViewLayout = this.onViewLayout.bind(this);
    this.onContainerLayout = this.onContainerLayout.bind(this);
    this.renderBackdrop = this.renderBackdrop.bind(this);
    this.renderContent = this.renderContent.bind(this);
    this.open = this.open.bind(this);
    this.close = this.close.bind(this);
  }

  onBackPress() {
    this.close();

    return true;
  }
  subscriptions;
  onViewLayoutCalculated;
  componentWillMount() {
    this.createPanResponder();
    this.handleOpenning(this.props);
    // Needed for IOS because the keyboard covers the screen
    if (Platform.OS === "ios") {
      this.subscriptions = [
        Keyboard.addListener("keyboardWillChangeFrame", this.onKeyboardChange),
        Keyboard.addListener("keyboardDidHide", this.onKeyboardHide)
      ];
    }
  }
  componentWillUnmount() {
    if (this.subscriptions) this.subscriptions.forEach(sub => sub.remove());
    if (this.props.backButtonClose && Platform.OS === "android")
      BackButton.removeEventListener("hardwareBackPress", this.onBackPress);
  }
  componentWillReceiveProps(props) {
    if (this.props.isOpen !== props.isOpen) {
      this.handleOpenning(props);
    }
  }
  handleOpenning(props) {
    if (typeof props.isOpen === "undefined") return;
    if (props.isOpen) this.open();
    else this.close();
  }
  /****************** ANIMATIONS **********************/

  /*
   * The keyboard is hidden (IOS only)
   */
  onKeyboardHide() {
    this.setState({ keyboardOffset: 0 });
  }

  /*
   * The keyboard frame changed, used to detect when the keyboard open, faster than keyboardDidShow (IOS only)
   */
  onKeyboardChange(evt) {
    if (!evt) return;
    if (!this.state.isOpen) return;
    const keyboardFrame = evt.endCoordinates;
    const keyboardHeight = this.state.containerHeight - keyboardFrame.screenY;

    this.setState({ keyboardOffset: keyboardHeight }, () => {
      this.animateOpen();
    });
  }
  /*
   * Open animation for the backdrop, will fade in
   */
  animateBackdropOpen() {
    if (this.state.isAnimateBackdrop && this.state.animBackdrop) {
      this.state.animBackdrop.stop();
    }
    this.setState({ isAnimateBackdrop: true });

    const animBackdrop = Animated.timing(this.state.backdropOpacity, {
      toValue: 1,
      duration: this.props.animationDuration,
      easing: this.props.easing,
      useNativeDriver: this.props.useNativeDriver
    });
    animBackdrop.start(() => {
      this.setState({
        isAnimateBackdrop: false,
        animBackdrop
      });
    });
  }

  /*
   * Close animation for the backdrop, will fade out
   */
  animateBackdropClose() {
    if (this.state.isAnimateBackdrop && this.state.animBackdrop) {
      this.state.animBackdrop.stop();
    }
    this.setState({ isAnimateBackdrop: true });

    const animBackdrop = Animated.timing(this.state.backdropOpacity, {
      toValue: 0,
      duration: this.props.animationDuration,
      easing: this.props.easing,
      useNativeDriver: this.props.useNativeDriver
    });
    animBackdrop.start(() => {
      this.setState({
        isAnimateBackdrop: false,
        animBackdrop
      });
    });
  }

  /*
   * Stop opening animation
   */
  stopAnimateOpen() {
    if (this.state.isAnimateOpen) {
      if (this.state.animOpen) this.state.animOpen.stop();
      this.setState({ isAnimateOpen: false });
    }
  }
  /*
   * Open animation for the modal, will move up
   */
  animateOpen() {
    this.stopAnimateClose();

    // Backdrop fadeIn
    if (this.props.backdrop) this.animateBackdropOpen();

    this.setState(
      {
        isAnimateOpen: true,
        isOpen: true
      },
      () => {
        requestAnimationFrame(() => {
          // Detecting modal position
          let positionDest = this.calculateModalPosition(
            this.state.containerHeight - this.state.keyboardOffset
          );
          if (
            this.state.keyboardOffset &&
            positionDest < this.props.keyboardTopOffset
          ) {
            positionDest = this.props.keyboardTopOffset;
          }
          const animOpen = Animated.timing(this.state.position, {
            toValue: positionDest,
            duration: this.props.animationDuration,
            easing: this.props.easing,
            useNativeDriver: this.props.useNativeDriver
          });
          animOpen.start(() => {
            this.setState({
              isAnimateOpen: false,
              animOpen,
              positionDest
            });
            if (this.props.onOpened) this.props.onOpened();
          });
        });
      }
    );
  }

  /*
   * Stop closing animation
   */
  stopAnimateClose() {
    if (this.state.isAnimateClose) {
      if (this.state.animClose) this.state.animClose.stop();
      this.setState({ isAnimateClose: false });
    }
  }

  /*
   * Close animation for the modal, will move down
   */
  animateClose() {
    this.stopAnimateOpen();

    // Backdrop fadeout
    if (this.props.backdrop) this.animateBackdropClose();

    this.setState(
      {
        isAnimateClose: true,
        isOpen: false
      },
      () => {
        const animClose = Animated.timing(this.state.position, {
          toValue:
            this.props.entry === "top"
              ? -this.state.containerHeight
              : this.state.containerHeight,
          duration: this.props.animationDuration,
          easing: this.props.easing,
          useNativeDriver: this.props.useNativeDriver
        });
        animClose.start(() => {
          // Keyboard.dismiss();   // make this optional. Easily user defined in .onClosed() callback
          this.setState({
            isAnimateClose: false,
            animClose
          });
          if (this.props.onClosed) this.props.onClosed();
        });
      }
    );
  }

  /*
   * Calculate when should be placed the modal
   */
  calculateModalPosition(containerHeight) {
    let position = 0;

    if (this.props.position === "bottom") {
      position = containerHeight - this.state.height;
    } else if (this.props.position === "center") {
      position = containerHeight / 2 - this.state.height / 2;
    }
    // Checking if the position >= 0
    if (position < 0) position = 0;

    return position;
  }

  /*
   * Create the pan responder to detect gesture
   * Only used if swipeToClose is enabled
   */
  createPanResponder() {
    let closingState = false;
    let inSwipeArea = false;

    const onPanRelease = (_, state) => {
      if (!inSwipeArea) return;
      inSwipeArea = false;
      if (
        this.props.entry === "top"
          ? -state.dy > this.props.swipeThreshold
          : state.dy > this.props.swipeThreshold
      )
        this.animateClose();
      else if (!this.state.isOpen) {
        this.animateOpen();
      }
    };

    const animEvt = Animated.event([null, { customY: this.state.position }]);

    const onPanMove = (evt, state) => {
      const newClosingState =
        this.props.entry === "top"
          ? -state.dy > this.props.swipeThreshold
          : state.dy > this.props.swipeThreshold;
      if (this.props.entry === "top" ? state.dy > 0 : state.dy < 0) return;
      if (newClosingState !== closingState && this.props.onClosingState)
        this.props.onClosingState(newClosingState);
      closingState = newClosingState;
      state.customY = state.dy + this.state.positionDest;

      animEvt(evt, state);
    };

    const onPanStart = evt => {
      if (
        !this.props.swipeToClose ||
        this.props.isDisabled ||
        (this.props.swipeArea &&
          evt.nativeEvent.pageY - this.state.positionDest >
            this.props.swipeArea)
      ) {
        inSwipeArea = false;

        return false;
      }
      inSwipeArea = true;

      return true;
    };

    this.setState({
      pan: PanResponder.create({
        onStartShouldSetPanResponder: onPanStart,
        onPanResponderMove: onPanMove,
        onPanResponderRelease: onPanRelease,
        onPanResponderTerminate: onPanRelease
      })
    });
  }

  /*
   * Event called when the modal view layout is calculated
   */
  onViewLayout(evt) {
    const height = evt.nativeEvent.layout.height;
    const width = evt.nativeEvent.layout.width;

    // If the dimensions are still the same we're done
    const heightChanged = height !== this.state.height;
    const widthChanged = width !== this.state.width;
    if (heightChanged && widthChanged) {
      this.setState({ height, width }, () => {
        if (this.onViewLayoutCalculated) {
          setTimeout(this.onViewLayoutCalculated, 0);
        }
      });
    } else if (widthChanged) {
      this.setState({ width }, () => {
        if (this.onViewLayoutCalculated) {
          setTimeout(this.onViewLayoutCalculated, 0);
        }
      });
    } else if (heightChanged) {
      this.setState({ height }, () => {
        if (this.onViewLayoutCalculated) {
          setTimeout(this.onViewLayoutCalculated, 0);
        }
      });
    }
  }

  /*
   * Event called when the container view layout is calculated
   */
  onContainerLayout(evt) {
    const height = evt.nativeEvent.layout.height;
    const width = evt.nativeEvent.layout.width;

    // If the container size is still the same we're done
    if (
      height === this.state.containerHeight &&
      width === this.state.containerWidth
    ) {
      this.setState({ isInitialized: true });

      return;
    }

    if (this.state.isOpen || this.state.isAnimateOpen) {
      this.animateOpen();
    }

    if (this.props.onLayout) this.props.onLayout(evt);
    this.setState({
      isInitialized: true,
      containerHeight: height,
      containerWidth: width
    });
  }

  /*
   * Render the backdrop element
   */
  renderBackdrop() {
    let backdrop;

    if (this.props.backdrop) {
      backdrop = (
        <TouchableWithoutFeedback
          onPress={() => this.props.backdropPressToClose && this.close()}
        >
          <Animated.View
            importantForAccessibility="no"
            style={[styles.absolute, { opacity: this.state.backdropOpacity }]}
          >
            <View
              style={[
                styles.absolute,
                {
                  backgroundColor: this.props.backdropColor,
                  opacity: this.props.backdropOpacity
                }
              ]}
            />
            {this.props.backdropContent || []}
          </Animated.View>
        </TouchableWithoutFeedback>
      );
    }

    return backdrop;
  }

  renderContent() {
    const size = {
      height: this.state.containerHeight,
      width: this.state.containerWidth
    };
    const offsetX = (this.state.containerWidth - this.state.width) / 2;

    return (
      <Animated.View
        onLayout={this.onViewLayout}
        style={[
          styles.wrapper,
          size,
          this.props.style,
          {
            transform: [
              { translateY: this.state.position },
              { translateX: offsetX }
            ]
          }
        ]}
        {...(this.state.pan && { ...this.state.pan.panHandlers })}
      >
        {this.props.backdropPressToClose && (
          <TouchableWithoutFeedback onPress={this.close}>
            <View style={[styles.absolute]} />
          </TouchableWithoutFeedback>
        )}
        {this.props.children}
      </Animated.View>
    );
  }
  /*
   * Render the component
   */

  render() {
    const visible =
      this.state.isOpen ||
      this.state.isAnimateOpen ||
      this.state.isAnimateClose;
    // var webCoverScreen = Platform.OS==='web'&& this.props.coverScreen;
    if (!visible) return <View />;

    const content = (
      <View
        importantForAccessibility="yes"
        accessibilityViewIsModal
        style={[styles.transparent, styles.absolute]}
        pointerEvents={"box-none"}
      >
        <View
          style={{ flex: 1 }}
          pointerEvents={"box-none"}
          onLayout={this.onContainerLayout}
        >
          {visible && this.renderBackdrop()}
          {visible && this.renderContent()}
        </View>
      </View>
    );

    if (!this.props.coverScreen) return content;

    return (
      <Modal
        onRequestClose={() => {
          if (this.props.backButtonClose) {
            this.close();
          }
        }}
        supportedOrientations={[
          "landscape",
          "portrait",
          "portrait-upside-down"
        ]}
        transparent
        visible={visible}
        hardwareAccelerated
      >
        {content}
      </Modal>
    );
  }

  /****************** PUBLIC METHODS **********************/

  open() {
    if (this.props.isDisabled) return;

    if (
      !this.state.isAnimateOpen &&
      (!this.state.isOpen || this.state.isAnimateClose)
    ) {
      this.onViewLayoutCalculated = () => {
        this.setState({});
        this.animateOpen();
        if (this.props.backButtonClose && Platform.OS === "android")
          BackButton.addEventListener("hardwareBackPress", this.onBackPress);
        delete this.onViewLayoutCalculated;
      };
      this.onViewLayoutCalculated();
      this.setState({ isAnimateOpen: true });
    }
  }

  close() {
    if (this.props.isDisabled) return;
    if (
      !this.state.isAnimateClose &&
      (this.state.isOpen || this.state.isAnimateOpen)
    ) {
      this.animateClose();
      if (this.props.backButtonClose && Platform.OS === "android")
        BackButton.removeEventListener("hardwareBackPress", this.onBackPress);
    }
  }
}
