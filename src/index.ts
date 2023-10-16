import {
    $query,
    $update,
    Record,
    StableBTreeMap,
    Vec,
    match,
    Result,
    nat64,
    ic,
} from "azle";
import {v4 as uuidv4, validate as isValidUUID} from "uuid";

// Define a type for a package holder
type PackageHolder = Record<{
    uuid: string;
    name: string;
}>;

// Define a type for a package
//TODO fix with enum if possible
//type PackageStatus = "processing" | "in transit" | "delivered";

const packageStatusStrings = {
    PROCESSING: "processing",
    IN_TRANSIT: "in transit",
    DELIVERED: "delivered",
}


// Define a type for history with package holder and current timestamp
type PackageHolderWithTimestamp = Record<{
    packageHolder: PackageHolder;
    timestamp: nat64;
}>;

type Package = Record<{
    id: string;
    status: string;
    sender: PackageHolder;
    recipient: PackageHolder;
    currentPackageHolder: PackageHolder;
    deliveryHistory: Vec<PackageHolderWithTimestamp>;
    createdAt: nat64;
}>;

// Define storage for packages
const packageStorage = new StableBTreeMap<string, Package>(0, 44, 1024);

// Define storage for package holders
const packageHolderStorage = new StableBTreeMap<string, PackageHolder>(1, 44, 1024,);

// Function to create a new package holder
$update;

export function createPackageHolder(
    name: string,
): Result<PackageHolder, string> {
    if (!name) {
        return Result.Err("Name is required.");
    }

    const packageHolderUUID = uuidv4();
    const newPackageHolder: PackageHolder = {
        uuid: packageHolderUUID,
        name,
    };

    packageHolderStorage.insert(packageHolderUUID, newPackageHolder);
    return Result.Ok(newPackageHolder);
}

// Function to get a package holder by UUID
$query;

export function getPackageHolderById(
    uuid: string,
): Result<PackageHolder, string> {
    if (!isValidUUID(uuid)) {
        return Result.Err("Invalid package holder UUID.");
    }

    return match(packageHolderStorage.get(uuid), {
        Some: (packageHolderFound) =>
            Result.Ok<PackageHolder, string>(packageHolderFound),
        None: () => Result.Err<PackageHolder, string>("Package holder not found."),
    });
}

// Function to create a new package with sender, recipient, and the first delivery person
$update;

export function createPackage(
    senderId: string,
    recipientId: string,
    firstDeliveryPersonId: string,
): Result<Package, string> {
    if (!senderId || !recipientId || !firstDeliveryPersonId) {
        return Result.Err(
            "Sender, recipient, and first delivery person ids are required.",
        );
    }

    if (!isValidUUID(senderId) || !isValidUUID(recipientId) || !isValidUUID(firstDeliveryPersonId)) {
        return Result.Err(
            "Invalid sender, recipient, or first delivery person ID.",
        );
    }

    const sender = getPackageHolderById(senderId);

    if (!sender || !sender.Ok || sender.Err) {
        return Result.Err<Package, string>(
            `Could not update package with the holder id=${senderId}. Package holder not found!`,
        );
    }

    const recipient = getPackageHolderById(recipientId);

    if (!recipient || !recipient.Ok || recipient.Err) {
        return Result.Err<Package, string>(
            `Could not update package with the holder id=${recipientId}. Package holder not found!`,
        );
    }

    const firstDeliveryPerson = getPackageHolderById(firstDeliveryPersonId);

    if (!firstDeliveryPerson || !firstDeliveryPerson.Ok || firstDeliveryPerson.Err) {
        return Result.Err<Package, string>(
            `Could not update package with the holder id=${firstDeliveryPersonId}. Package holder not found!`,
        );
    }

    const packageId = uuidv4();
    const currentTimestamp = ic.time();
    const newPackage: Package = {
        id: packageId,
        sender: sender.Ok,
        recipient: recipient.Ok,
        status: packageStatusStrings.PROCESSING, // Set the initial status as "processing"
        currentPackageHolder: firstDeliveryPerson.Ok, // Set the current package holder
        deliveryHistory: [
            // Add the sender to the history upon creation
            {
                packageHolder: sender.Ok,
                timestamp: currentTimestamp,
            },
            // Add the initial delivery person to the history upon creation
            {
                packageHolder: firstDeliveryPerson.Ok,
                timestamp: currentTimestamp,
            },
        ],
        createdAt: currentTimestamp,
    };

    packageStorage.insert(packageId, newPackage);
    return Result.Ok(newPackage);
}

// Function to get a package by ID
$query;

export function getPackageById(packageId: string): Result<Package, string> {
    if (!isValidUUID(packageId)) {
        return Result.Err("Invalid package ID.");
    }

    return match(packageStorage.get(packageId), {
        Some: (packageFound) => Result.Ok<Package, string>(packageFound),
        None: () => Result.Err<Package, string>("Package not found."),
    });
}

// Function to update the package holder and/or status
$update;

export function updatePackage(
    packageId: string,
    newPackageHolderId: string,
): Result<Package, string> {
    if (!isValidUUID(packageId) || !isValidUUID(newPackageHolderId)) {
        return Result.Err("Invalid package ID or package holder ID.");
    }

    const newPackageHolder = getPackageHolderById(newPackageHolderId);

    if (!newPackageHolder || !newPackageHolder.Ok || newPackageHolder.Err) {
        return Result.Err<Package, string>(
            `Could not update package with the new holder id=${newPackageHolderId}. Package holder not found!`,
        );
    }

    const existingPackage = getPackageById(packageId);

    if (!existingPackage || !existingPackage.Ok || existingPackage.Err) {
        return Result.Err<Package, string>(
            `Could not update package with the given id=${packageId}. Package not found!`,
        );
    }

    if (existingPackage.Ok.status === packageStatusStrings.DELIVERED) {
        return Result.Err<Package, string>(
            `Could not update package with the given id=${packageId}. Package already delivered!`,
        );
    }

    if (existingPackage.Ok.deliveryHistory.some(dh => dh.packageHolder.uuid === newPackageHolderId)) {
        return Result.Err<Package, string>(
            `Could not update package with the given id=${packageId}. New package holder already had the package!`,
        );
    }

    // Step 1: Set the updated status to "in transit"
    let updatedStatus = packageStatusStrings.IN_TRANSIT;

    // Check if the new package holder is the same as the recipient
    if (newPackageHolderId === existingPackage.Ok.recipient.uuid) {
        updatedStatus = packageStatusStrings.DELIVERED;
    }

    // Step 2: Create a new delivery history entry
    const newDeliveryHistoryEntry = {
        packageHolder: newPackageHolder.Ok,
        timestamp: ic.time(),
    };

    // Step 3: Create the updated package object
    const updatedPackage: Package = {
        ...existingPackage.Ok,
        status: updatedStatus, // Update the status after first package holder to "in transit" or to "delivered" if applicable
        currentPackageHolder: newPackageHolder.Ok, // Update the current package holder
        deliveryHistory: [
            ...existingPackage.Ok.deliveryHistory,
            newDeliveryHistoryEntry,
        ],
    };

    // Step 4: Update the package in storage
    packageStorage.insert(packageId, updatedPackage);

    // Step 5: Return the updated package as a Result.Ok
    return Result.Ok(updatedPackage);
}

// A workaround to make the uuid package work with Azle
globalThis.crypto = {
    // @ts-ignore
    getRandomValues: () => {
        const array = new Uint8Array(32);

        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }

        return array;
    },
};