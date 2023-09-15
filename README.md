# IC Package Tracking System

This is a simple and straightforward package tracking system designed for simplicity and ease of use on the Internet
Computer platform. It allows you to manage and track the status of packages, including sender, recipient, and delivery
personnel information. The system can update package statuses and maintains a detailed delivery history.

## Features

- **Create Packages:** Easily create packages with sender, recipient, and initial delivery person details.
- **Track Package Status:** Monitor package statuses as they move from "processing" to "in transit" and finally to "
  delivered."
- **Manage Package Holders:** Keep track of senders, recipients, and delivery personnel.
- **View Timestamps:** Each package event is timestamped, providing a clear timeline of package activities.

## Usage

Deploy the Simple IC Package Tracker on the Internet Computer platform, and you can start managing and tracking your
packages effortlessly. There's no need for complex APIs or extensive coding. Here's how to get started:

1. **Deploy the Project:** Deploy the Simple IC Package Tracker on the Internet Computer platform. You can find
   deployment instructions in the project's documentation.

2. **Create Packages:** Once deployed, you can start creating packages effortlessly. Each package includes sender,
   recipient, and initial delivery person details.

3. **Track Packages:** Monitor your packages' statuses in real-time. The system automatically updates statuses as
   packages move from "processing" to "in transit" and finally to "delivered."

4. **Manage Package Holders:** Keep track of senders, recipients, and delivery personnel with ease.

5. **View Timestamps:** The system timestamps each package event, giving you a clear timeline of all package activities.

## Setup

Install dfx using

```
DFX_VERSION=0.14.1 sh -ci "$(curl -fsSL https://sdk.dfinity.org/install.sh)"
```

Add it to your PATH variables using

```
echo 'export PATH="$PATH:$HOME/bin"' >> "$HOME/.bashrc"
```

Execute this to start it

```
dfx start --background
```

To deploy use this. It will take a while the first time.

```
dfx deploy
```

You should get a URL where you can test all the functions.

## Functions

### Create a Package Holder

You can create a package holder with a name:

```
createPackageHolder("John Doe");
```

### Get a Package Holder by UUID

You can retrieve a package holder by its UUID:

```
getPackageHolderById("<uuid>");
```

### Create a New Package

Create a new package with a sender, recipient, and the first delivery person's ids:

```
createPackage("<sender_uuid>", "<recipient_uuid>", "<delivery_person_uuid>");
```

### Update Package Status and Holder

Update the package holder and/or status of a package:

```
updatePackage("<package_uuid>", "<new_package_holder_uuid>");
```

### Get a Package by ID

Retrieve a package by its ID:

```
getPackageById("<package_uuid>");
```

### Package Status

- "processing": Initial status upon creation.
- "in transit": After the first change of the delivery person.
- "delivered": When the package holder is the same as the recipient.

## Project Repository

I am open for any suggestion and pull requests, but please test them first in order to verify that all is working.

For more details and access to the project's source code, please visit
the [GitHub Repository](https://github.com/lapd87/IC-tracker).
