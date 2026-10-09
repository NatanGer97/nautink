/** Class diagram sources for round-trip tests: v1's templates plus the edge cases v1 handles. */
export const CLASS_FIXTURES: Readonly<Record<string, string>> = {
  template: `classDiagram
    class Animal {
        <<abstract>>
        +String name
        +int age
        +makeSound() void*
    }
    class Dog {
        +String breed
        +fetch() void
    }
    class Cat {
        +bool indoor
        +climb() void
    }
    class Owner {
        +String name
        +adopt(Animal a) void
    }
    Animal <|-- Dog
    Animal <|-- Cat
    Owner "1" o-- "0..*" Animal : owns
`,
  blank: 'classDiagram\n    class Class1\n',
  v2Header: 'classDiagram-v2\n    direction LR\n    A --> B\n',
  directionTB: 'classDiagram\n    direction TB\n    class A\n',
  members: `classDiagram
    class Shape~T~ {
        <<interface>>
        <<service>>
        -List~List~int~~ points$
        #area() double*
        ~resize(int w, int h) bool
        +static() int$
    }
    class \`My Class\`["A label"] {
        +x
    }
    class Plain
    class Tinted:::hot
`,
  relations: `classDiagram
    A <|-- B
    C *-- D
    E o-- F
    G <-- H
    I -- J
    K ..> L
    M ..|> N
    O .. P
    Q <|--|> R : both ends
    S "many" --> "1" T : label with #colon; colon
    U --> V : say "hi"
    A <|-- B
`,
  lollipops: 'classDiagram\n    Bar ()-- Foo\n    Baz --() Qux\n',
  namespaces: `classDiagram
    namespace Shapes {
        class Square
        class Circle {
            +radius
        }
    }
    namespace Outer.Inner {
        class Deep
    }
    Square --> Circle
`,
  notes: `classDiagram
    class A
    note "A free note"
    note for A "Line one\\nLine two"
    note for A "Second note"
`,
  styling: `classDiagram
    %% a comment that is dropped
    class A:::hot {
        +x
    }
    class B
    cssClass "A,B" cool
    classDef hot fill:#f00
    classDef cool stroke:#00f
    style B fill:#0f0
    click A href "https://example.com"
    link B "https://example.com"
    callback A "cb"
    accTitle: Title
    accDescr {
        Long
        description
    }
`,
  preamble: `---
title: Classes
---
classDiagram
    A --> B
`,
};
