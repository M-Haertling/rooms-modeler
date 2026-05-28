# Core
* The metric can be set/changed for the canvas (feet, inches, cm, etc.) and the segment sizes will display in that 
* Define objects
* An object is a collection of points
    * Type 1 - standard (starts as a square)
    * Type 2 - round (starts as a circle)
        * No editing of points
        * Only support length and width
* Standard Objects
    * A segment (between two points) can be selected
    * Any point can be selected
    * Points can be dragged to adjust the shape by the user
    * A segment has a length - implied by its points
    * A segment can be split, resulting in a new point being added at the center of the segment
    * The user can change the length of a segment (the points adjust automatically)
    * Locking
        * A point can be locked, preventing it from moving
        * A segment can be locked, preventing its length from changing
            * Either point of the segment can still be dragged, but will always remain the same distance from its paired point
        * If both points of a segment at locked, the segment length cannot be changed/modified
    * By dragging the mouse or shift clicking points, multiple can be selected and then moved together
* Object attributes
    * Visual
        * Line color
        * Fill color
        * Line thickness
    * Notes
    * Total width and height
    * Locked - if enabled, the entire object is locked and can only be moved, not re-sized
    * Name
    * URL
    * Supplementary dimensions
        * Height (optional)
        * Define your own (for example, if the object represents a chair, the height of the seat may be custom defined)
    * Type (user can define types that are shared between objects for grouping/classification) - e.g. Chair, Sofa, Table, etc.
    * Owned - a boolean that indicates if the object is owned (already purchased); this is used if the object represents furniture to differenciate between proposed and owned
    * Cost ($)
    * Images - user can attach images to the object
* Point attributes
    * Snapping - determines if a point will snap to other points that also have snapping enabled
        * If they are close enough together when moving the object, the object will move so that the points perfectly overlap
* Object actions
    * Duplicate
    * Lock/unlock
    * Rotation
* Templates
    * An object can be saved as a template to be inserted into the canvas multiple times
    * When saving a template, store the points in unit form (1x1 total size)
    * When creating an object from a template
        * Ask the user what size in units are desired
        * Ask the user for a name

# UI
* Create one or more models
    * A model is a sqlite db file
    * Opening a model is to select a sqlite db
* All catalogs are searchable
* Object catalog - a list of all object in the canvas
* Template catalog
* Layer catalog
    * Layers can be hidden - this is used to create options when designing rooms or simplifying the model for certain purposes
    * Cost - the total cost of a layer is the sum of the cost of all objects/layers inside the layer
* Object hierarchy
    * User can define layers
    * Layers can contain other layers and/or objects
    * Think of this similar to a folder/directory structure
    * Objects and layers can be dragged between layers
* Hovering over any segment will display its length and name in a quick tool-tip
* Clicking a segment, or point will bring up a side-panel with the segment or point attributes in one section and the object details in the other section
* A selected segment or point will be colored to indicate it is selected
* The points of a selected object will be indicated but softer than the directly selected components




* Under appearance, enable the adjustment of transparency of the fill color (if enabled) - default to fully opaque
* Enable objects to contain other objects in the layers bar
    * When objects are moved, their sub-objects are moved as well
    * Example, a room object contains the furniture in it - moving the room moves the furniture
* In the layers menu, the vertical ordering matters when rendering the objects
    * Render parents first, then sub-objects/childen next
    * If in the same layer/parent object then render bottom up
        * Example: a rug listed under a chair - the rug is rendered first, then the chair - resulting in the chair covering part of the rug
* Make objects also have the eye (visible/hidden) toggle in the layers menu
* Add option to scale the side of objects without moving individual points
    * This could be when the full object is selected - display little corner markers at each point that can be dragged to scale the whole object

* Enable setting object level dimensions - similar to using the scaling feature but entering specific numbers in the OBJECT details section
* Object types are Room, Counter, Furniture - suggest any others
* When attempting to select a round object with no fill, only clicking the border selects it - enable clicking the center to also select similar to non-round objects
* How can we enable show dimensions to display for round objects?
* Add a toggle-able show name option
    * Try to display the name such that it does not overlap other objects
* Enable setting object level dimensions - similar to using the scaling feature but entering specific numbers in the OBJECT details section

* When numbers are adjusted manually like segment length or point locations, ensure that no locked values are changed
    * I specifically have observed changes to the angle of a point resulting in a different locked point being moved
* Move the scale point out a bit from the frame of the object because if the true point is right on the frame, its impossible to click just the point and not the scaler
* Move the transparent option for a segment to be part of the segment type selection - maybe call it "Empty" so it fits better
* Add multiple modes to select from for the background
    * Dark (current)
    * Blueprint (traditional blueprint)
    * Propose others








* New Feature: Configurations
    * A layer can have configurations
    * Click a button on layer in the layer menu to open the configuration panel to the right of it
    * Configuration is a positioning of all objects in that layer
    * Swap between configurations by choosing it in the menu
    * Create / delete configurations
    * Name / rename configurations
* New Feature: Tape Measure
    * Enable tape measure mode
    * Click and drag to measure distances
    * Can also be enabled with ctrl+click and drag
* Square Mode
    * Points can be set to square mode
    * Allow mass setting if multi-selected
    * In square mode, the angle of the lines for that point must be 90 degree increments of each other
    * This is useful because most of the time, rooms are made up of 90 degree angles
* Enable a toggle to show or hide all points in the model - it is useful to hide the points when just moving around furniture

* Version control system implementation
    * 